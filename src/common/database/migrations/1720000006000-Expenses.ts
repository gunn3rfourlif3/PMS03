import { MigrationInterface, QueryRunner } from 'typeorm';

/** Property expenses (owner-billable recovery), RLS-scoped, operational. */
export class Expenses1720000006000 implements MigrationInterface {
  name = 'Expenses1720000006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "property_id" uuid,
        "unit_id" uuid,
        "owner_id" uuid,
        "category" varchar NOT NULL,
        "amount" numeric NOT NULL,
        "vendor_bill_ref" varchar,
        "owner_billable" boolean NOT NULL DEFAULT false,
        "incurred_on" date NOT NULL,
        "status" text NOT NULL DEFAULT 'recorded',
        "document_id" uuid,
        "statement_id" uuid,
        "ledger_txn_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_expenses_owner_status" ON "expenses" ("vendor_id","owner_id","status");`);

    await q.query(`ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "expenses_tenant_isolation" ON "expenses"
      USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
      WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "expenses_tenant_isolation" ON "expenses";`);
    await q.query(`DROP TABLE IF EXISTS "expenses";`);
  }
}
