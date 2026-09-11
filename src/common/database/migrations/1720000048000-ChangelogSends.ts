import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which changelog entries have been emailed, and to how many people.
 *
 * The entries themselves live in the repo (`changelog-entries.ts`), written in
 * the same commit as the change they describe. Only the FACT of sending is
 * state, and it belongs in the database because it must survive a redeploy —
 * the one thing worse than not telling partners about a change is telling them
 * three times.
 *
 * `recipients` is a snapshot, not a live count: it records who it actually
 * reached on the day, which is the number you want a year later when someone
 * says they never heard about the reprice.
 */
export class ChangelogSends1720000048000 implements MigrationInterface {
  name = 'ChangelogSends1720000048000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS changelog_sends (
        entry_id    text PRIMARY KEY,
        sent_at     timestamptz NOT NULL DEFAULT now(),
        sent_by     uuid REFERENCES users(id) ON DELETE SET NULL,
        recipients  int NOT NULL DEFAULT 0,
        subject     text
      );`);

    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
        GRANT SELECT, INSERT ON changelog_sends TO pms_app;
      END IF;
    END $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS changelog_sends;`);
  }
}
