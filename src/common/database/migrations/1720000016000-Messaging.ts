import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * In-app messaging: tenant <-> staff conversation threads and their messages.
 * Both tables are vendor-scoped with forced RLS (null-safe GUC lookup).
 */
export class Messaging1720000016000 implements MigrationInterface {
  name = 'Messaging1720000016000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "subject" varchar NOT NULL,
        "tenant_user_id" uuid NOT NULL,
        "unit_id" uuid,
        "status" text NOT NULL DEFAULT 'open',
        "last_message_at" timestamptz,
        "last_message_preview" text,
        "tenant_last_read_at" timestamptz,
        "staff_last_read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_conversations_tenant" ON "conversations" ("vendor_id","tenant_user_id");`);
    await q.query(`CREATE INDEX "ix_conversations_status" ON "conversations" ("status");`);

    await q.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "conversation_id" uuid NOT NULL,
        "sender_user_id" uuid NOT NULL,
        "sender_role" text NOT NULL,
        "body" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE INDEX "ix_messages_conversation" ON "messages" ("vendor_id","conversation_id");`);

    for (const table of ['conversations', 'messages']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid)
        WITH CHECK ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid);
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['messages', 'conversations']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
      await q.query(`DROP TABLE IF EXISTS "${table}";`);
    }
  }
}
