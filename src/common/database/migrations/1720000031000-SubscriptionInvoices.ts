import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #181: subscription invoices — the monthly bill an agency owes the platform for
 * its Growth/Enterprise plan. PLATFORM-SCOPED (no RLS). One issued invoice per
 * (vendor, period); idempotent generation.
 */
export class SubscriptionInvoices1720000031000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS subscription_invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id uuid NOT NULL,
        period text NOT NULL,
        tier text NOT NULL,
        unit_count int NOT NULL DEFAULT 0,
        amount numeric NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'issued',
        due_date date,
        paid_at timestamptz,
        paid_ref text,
        gateway_ref text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (vendor_id, period)
      );
      CREATE INDEX IF NOT EXISTS subscription_invoices_vendor_idx ON subscription_invoices(vendor_id, period);`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS subscription_invoices;`);
  }
}
