import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owners, owner statements, and payouts (agency use case), all RLS-scoped.
 * owners: operational (soft-delete). owner_statements + payouts: append-only
 * records with mutable status.
 */
export class Owners1720000003000 implements MigrationInterface {
  name = 'Owners1720000003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "owners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "contact" jsonb NOT NULL DEFAULT '{}',
        "payout_subaccount" varchar,
        "management_fee_pct" numeric NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);

    await q.query(`
      CREATE TABLE "owner_statements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "period" varchar NOT NULL,
        "gross_collected" numeric NOT NULL DEFAULT 0,
        "management_fee" numeric NOT NULL DEFAULT 0,
        "expenses" numeric NOT NULL DEFAULT 0,
        "net_payout" numeric NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'draft',
        "ledger_txn_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_statement_vendor_owner_period" ON "owner_statements" ("vendor_id","owner_id","period");`);
    await q.query(`CREATE INDEX "ix_statement_status" ON "owner_statements" ("status");`);

    await q.query(`
      CREATE TABLE "payouts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "statement_id" uuid NOT NULL,
        "amount" numeric NOT NULL,
        "gateway_ref" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'scheduled',
        "ledger_txn_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_payouts_gateway_ref" ON "payouts" ("gateway_ref");`);
    await q.query(`CREATE INDEX "ix_payouts_status" ON "payouts" ("status");`);

    for (const table of ['owners', 'owner_statements', 'payouts']) {
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
    for (const table of ['owners', 'owner_statements', 'payouts']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "payouts";`);
    await q.query(`DROP TABLE IF EXISTS "owner_statements";`);
    await q.query(`DROP TABLE IF EXISTS "owners";`);
  }
}
