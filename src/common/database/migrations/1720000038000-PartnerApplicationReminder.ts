import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-stage partner application.
 *
 * Stage 1 captures contact details only (status 'started') and emails a link to
 * complete KYC/KYB; `reminder_sent_at` records the single follow-up nudge so the
 * reminder job never mails the same applicant twice.
 *
 * `status` is a plain text column, so the new 'started' value needs no DDL. The
 * partial index keeps the reminder sweep cheap as the table grows.
 */
export class PartnerApplicationReminder1720000038000 implements MigrationInterface {
  name = 'PartnerApplicationReminder1720000038000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_partner_apps_unfinished
        ON partner_applications (created_at)
        WHERE reminder_sent_at IS NULL AND status IN ('started', 'draft')
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_partner_apps_unfinished`);
    await q.query(`ALTER TABLE partner_applications DROP COLUMN IF EXISTS reminder_sent_at`);
  }
}
