import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts (chart of accounts) + Invoices, with RLS, plus the billing worklist
 * function used by the recurring invoice job.
 *
 * - accounts: operational (soft-delete allowed).
 * - invoices: append-only (no deleted_at; UPDATE/DELETE blocked) — a void is a
 *   reversing ledger entry, not an edit.
 */
export class BillingAndAccounts1720000001000 implements MigrationInterface {
  name = 'BillingAndAccounts1720000001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type" text NOT NULL,
        "is_trust" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_accounts_vendor_code" ON "accounts" ("vendor_id","code");`);

    await q.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "lease_id" uuid NOT NULL,
        "tenant_id" uuid,
        "period" varchar NOT NULL,
        "due_date" date NOT NULL,
        "status" text NOT NULL DEFAULT 'issued',
        "total" numeric NOT NULL,
        "line_items" jsonb NOT NULL DEFAULT '[]',
        "ledger_txn_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_invoice_vendor_lease_period" ON "invoices" ("vendor_id","lease_id","period");`);
    await q.query(`CREATE INDEX "ix_invoices_status" ON "invoices" ("status");`);

    // RLS
    for (const table of ['accounts', 'invoices']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
        WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
      `);
    }

    // invoices append-only (accounts may be edited/soft-deleted).
    await q.query(`CREATE RULE "invoices_no_update" AS ON UPDATE TO "invoices" DO INSTEAD NOTHING;`);
    await q.query(`CREATE RULE "invoices_no_delete" AS ON DELETE TO "invoices" DO INSTEAD NOTHING;`);

    // Billing worklist: active leases with no invoice yet for the period.
    // SECURITY DEFINER so the batch job can read across tenants; the caller
    // then posts each vendor's invoices inside that vendor's tenant context.
    await q.query(`
      CREATE OR REPLACE FUNCTION billing_active_leases(p_period text)
      RETURNS TABLE(vendor_id uuid, lease_id uuid, tenant_id uuid, rent_amount numeric)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT l.vendor_id, l.id AS lease_id, NULL::uuid AS tenant_id, l.rent_amount
        FROM leases l
        WHERE l.status = 'active'
          AND l.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.lease_id = l.id AND i.period = p_period
          );
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS billing_active_leases(text);`);
    await q.query(`DROP RULE IF EXISTS "invoices_no_update" ON "invoices";`);
    await q.query(`DROP RULE IF EXISTS "invoices_no_delete" ON "invoices";`);
    for (const table of ['accounts', 'invoices']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "invoices";`);
    await q.query(`DROP TABLE IF EXISTS "accounts";`);
  }
}
