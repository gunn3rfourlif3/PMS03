import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Where did you hear about us?" on the demo form and the partner application.
 *
 * A column rather than a key in `leads.meta`, because the whole point is to
 * group by it — `SELECT source, count(*) FROM leads GROUP BY source` should be
 * the easy query, and it shows up in a plain `SELECT *` when someone is looking
 * at a lead in psql at 7am.
 *
 * Nullable on purpose: every lead captured before today has no answer, and a
 * default would invent one. An unanswered dropdown is data, not a bug.
 */
export class LeadSource1720000045000 implements MigrationInterface {
  name = 'LeadSource1720000045000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" text;`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_leads_source" ON "leads" ("source");`);
    await q.query(`ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "source" text;`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_partner_applications_source" ON "partner_applications" ("source");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_leads_source";`);
    await q.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "source";`);
    await q.query(`DROP INDEX IF EXISTS "ix_partner_applications_source";`);
    await q.query(`ALTER TABLE "partner_applications" DROP COLUMN IF EXISTS "source";`);
  }
}
