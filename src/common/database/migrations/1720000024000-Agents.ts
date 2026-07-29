import { MigrationInterface, QueryRunner } from 'typeorm';

/** Referral/introducer agents and their commissions (pending -> approved -> paid). */
export class Agents1720000024000 implements MigrationInterface {
  name = 'Agents1720000024000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "email" varchar,
        "phone" varchar,
        "company" varchar,
        "status" text NOT NULL DEFAULT 'active',
        "commission_type" text NOT NULL DEFAULT 'flat',
        "commission_value" numeric NOT NULL DEFAULT 0,
        "banking" jsonb NOT NULL DEFAULT '{}',
        "notes" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`
      CREATE TABLE "agent_commissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "agent_id" uuid NOT NULL,
        "type" text NOT NULL,
        "source_label" varchar NOT NULL,
        "basis" text NOT NULL DEFAULT 'flat',
        "amount" numeric NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "approved_at" timestamptz,
        "paid_at" timestamptz,
        "paid_ref" varchar,
        "note" varchar,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_agents_status" ON "agents" ("vendor_id", "status");`);
    await q.query(`CREATE INDEX "ix_agent_commissions_status" ON "agent_commissions" ("vendor_id", "status");`);
    await q.query(`CREATE INDEX "ix_agent_commissions_agent" ON "agent_commissions" ("agent_id");`);

    for (const table of ['agents', 'agent_commissions']) {
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
    for (const table of ['agents', 'agent_commissions']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "agent_commissions";`);
    await q.query(`DROP TABLE IF EXISTS "agents";`);
  }
}
