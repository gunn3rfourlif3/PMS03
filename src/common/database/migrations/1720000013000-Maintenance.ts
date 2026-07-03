import { MigrationInterface, QueryRunner } from 'typeorm';

/** Maintenance tickets + work orders, RLS-scoped. */
export class Maintenance1720000013000 implements MigrationInterface {
  name = 'Maintenance1720000013000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "reporter_id" uuid,
        "category" varchar NOT NULL,
        "priority" text NOT NULL DEFAULT 'medium',
        "description" text NOT NULL,
        "media" jsonb NOT NULL DEFAULT '[]',
        "status" text NOT NULL DEFAULT 'open',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_tickets_unit" ON "tickets" ("vendor_id","unit_id");`);
    await q.query(`CREATE INDEX "ix_tickets_status" ON "tickets" ("status");`);

    await q.query(`
      CREATE TABLE "work_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "ticket_id" uuid NOT NULL,
        "contractor_id" uuid,
        "status" text NOT NULL DEFAULT 'assigned',
        "scheduled_for" timestamptz,
        "cost" numeric,
        "notes" varchar,
        "expense_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_work_orders_status" ON "work_orders" ("status");`);

    for (const t of ['tickets', 'work_orders']) {
      await q.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${t}_tenant_isolation" ON "${t}"
        USING ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid)
        WITH CHECK ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid);
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['tickets', 'work_orders']) {
      await q.query(`DROP POLICY IF EXISTS "${t}_tenant_isolation" ON "${t}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "work_orders";`);
    await q.query(`DROP TABLE IF EXISTS "tickets";`);
  }
}
