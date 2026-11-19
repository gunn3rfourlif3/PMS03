import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which invoice billed a utility reading.
 *
 * Utilities are now recoverable on rent invoices (per agency, off by default).
 * A reading must be billed exactly once: this column is that guarantee. Null =
 * not yet billed; the invoice run claims null rows under FOR UPDATE and sets
 * this in the same transaction as the invoice.
 *
 * No GRANT needed: a new column inherits the table's privileges, and the
 * table's RLS policies already cover every column.
 */
export class UtilityReadingInvoice1720000058000 implements MigrationInterface {
  name = 'UtilityReadingInvoice1720000058000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "utility_readings" ADD COLUMN IF NOT EXISTS "invoice_id" uuid REFERENCES "invoices"("id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_utility_readings_unbilled" ON "utility_readings" ("meter_id") WHERE "invoice_id" IS NULL AND "deleted_at" IS NULL;`);
    await q.query(`COMMENT ON COLUMN "utility_readings"."invoice_id" IS 'Invoice that recovered this reading; null until billed. Set once.';`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_utility_readings_unbilled";`);
    await q.query(`ALTER TABLE "utility_readings" DROP COLUMN IF EXISTS "invoice_id";`);
  }
}
