import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notification delivery log + per-user preferences, RLS-scoped.
 * notifications: append-only delivery record. notification_preferences:
 * operational (editable/soft-delete).
 */
export class Notifications1720000004000 implements MigrationInterface {
  name = 'Notifications1720000004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "user_id" uuid,
        "channel" varchar NOT NULL,
        "template" varchar NOT NULL,
        "destination" varchar NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'queued',
        "provider_ref" varchar,
        "sent_at" timestamptz,
        "error" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE INDEX "ix_notifications_status" ON "notifications" ("status");`);
    await q.query(`CREATE INDEX "ix_notifications_user" ON "notifications" ("user_id");`);

    await q.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "opted_out" jsonb NOT NULL DEFAULT '[]',
        "quiet_hours" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_notif_pref_vendor_user" ON "notification_preferences" ("vendor_id","user_id");`);

    for (const table of ['notifications', 'notification_preferences']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
        WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['notifications', 'notification_preferences']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "notification_preferences";`);
    await q.query(`DROP TABLE IF EXISTS "notifications";`);
  }
}
