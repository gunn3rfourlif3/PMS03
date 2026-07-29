import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Move-in pricing on listings: an optional security deposit and a one-off
 * admin / lease fee. Both feed the move-in invoice sent to an approved applicant.
 * Default 0 so existing listings are unaffected.
 */
export class ListingMoveInPricing1720000025000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS deposit numeric NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS admin_fee numeric NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE listings DROP COLUMN IF EXISTS admin_fee`);
    await q.query(`ALTER TABLE listings DROP COLUMN IF EXISTS deposit`);
  }
}
