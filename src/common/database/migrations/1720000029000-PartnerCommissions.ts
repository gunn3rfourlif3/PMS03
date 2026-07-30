import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2: partner commissions — monthly accruals on referred-agency MRR.
 * PLATFORM-SCOPED (no RLS). Unique (partner, vendor, period) makes accrual
 * idempotent so re-running a month never double-pays.
 */
export class PartnerCommissions1720000029000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS partner_commissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL,
        vendor_id uuid NOT NULL,
        period text NOT NULL,
        basis_mrr numeric NOT NULL DEFAULT 0,
        rate numeric NOT NULL DEFAULT 0,
        amount numeric NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        approved_at timestamptz,
        paid_at timestamptz,
        paid_ref text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (partner_id, vendor_id, period)
      );
      CREATE INDEX IF NOT EXISTS partner_commissions_partner_idx ON partner_commissions(partner_id, period);`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS partner_commissions;`);
  }
}
