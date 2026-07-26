import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tenant-submitted proofs of payment (manual EFT), reviewed by staff. */
export class ProofOfPayment1720000021000 implements MigrationInterface {
  name = 'ProofOfPayment1720000021000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "proof_of_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "file_url" varchar NOT NULL,
        "amount" numeric,
        "paid_at" date,
        "reference" varchar,
        "note" varchar,
        "status" text NOT NULL DEFAULT 'pending',
        "review_note" varchar,
        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_pop_status" ON "proof_of_payments" ("status");`);
    await q.query(`CREATE INDEX "ix_pop_invoice" ON "proof_of_payments" ("invoice_id");`);
    await q.query(`CREATE INDEX "ix_pop_tenant" ON "proof_of_payments" ("tenant_id");`);

    await q.query(`ALTER TABLE "proof_of_payments" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "proof_of_payments" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "proof_of_payments_tenant_isolation" ON "proof_of_payments"
      USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
      WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "proof_of_payments_tenant_isolation" ON "proof_of_payments";`);
    await q.query(`DROP TABLE IF EXISTS "proof_of_payments";`);
  }
}
