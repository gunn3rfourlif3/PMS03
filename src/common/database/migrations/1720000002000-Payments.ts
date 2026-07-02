import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payments + dunning support, and a correction to the immutability model.
 *
 * Correction: the general ledger (ledger_entries) is the immutable source of
 * truth, but business DOCUMENTS (invoices, deposits) have lifecycle status that
 * legitimately changes. The earlier DB-level UPDATE/DELETE blocks on invoices
 * (and deposits) were too strict — they are dropped here. ledger_entries stays
 * fully immutable.
 */
export class Payments1720000002000 implements MigrationInterface {
  name = 'Payments1720000002000';

  public async up(q: QueryRunner): Promise<void> {
    // Relax over-strict immutability on business documents.
    await q.query(`DROP RULE IF EXISTS "invoices_no_update" ON "invoices";`);
    await q.query(`DROP RULE IF EXISTS "invoices_no_delete" ON "invoices";`);
    await q.query(`DROP RULE IF EXISTS "deposits_no_update" ON "deposits";`);
    await q.query(`DROP RULE IF EXISTS "deposits_no_delete" ON "deposits";`);

    // New invoice flag for one-time late-fee application.
    await q.query(
      `ALTER TABLE "invoices" ADD COLUMN "late_fee_applied" boolean NOT NULL DEFAULT false;`,
    );

    // Payments (append-only record; status transitions pending->succeeded).
    await q.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "tenant_id" uuid,
        "amount" numeric NOT NULL,
        "method" text NOT NULL DEFAULT 'eft',
        "gateway_ref" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "received_at" timestamptz,
        "allocation" jsonb NOT NULL DEFAULT '[]',
        "ledger_txn_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_payments_gateway_ref" ON "payments" ("gateway_ref");`);
    await q.query(`CREATE INDEX "ix_payments_status" ON "payments" ("status");`);

    await q.query(`ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "payments_tenant_isolation" ON "payments"
      USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
      WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
    `);

    // Dunning worklist: overdue, not-yet-charged invoices (cross-tenant read).
    await q.query(`
      CREATE OR REPLACE FUNCTION overdue_invoices()
      RETURNS TABLE(vendor_id uuid, invoice_id uuid)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT i.vendor_id, i.id AS invoice_id
        FROM invoices i
        WHERE i.status IN ('issued', 'partly_paid')
          AND i.late_fee_applied = false
          AND i.due_date < CURRENT_DATE;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS overdue_invoices();`);
    await q.query(`DROP POLICY IF EXISTS "payments_tenant_isolation" ON "payments";`);
    await q.query(`DROP TABLE IF EXISTS "payments";`);
    await q.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "late_fee_applied";`);
    // (Immutability rules intentionally not re-created.)
  }
}
