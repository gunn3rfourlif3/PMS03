import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * At most one OPEN listing (draft/published/paused) per unit. Terminal listings
 * (filled/closed) don't count, so a unit can be re-listed later.
 *
 * Existing duplicates are collapsed first (keep one per unit — prefer a
 * published one, then the newest — and close the rest) so the unique index can
 * be created.
 */
const OPEN = `('draft','published','paused')`;

export class UniqueOpenListing1720000020000 implements MigrationInterface {
  name = 'UniqueOpenListing1720000020000';

  public async up(q: QueryRunner): Promise<void> {
    // Close all but one open listing per unit.
    await q.query(`
      UPDATE listings SET status = 'closed', updated_at = now()
      WHERE status IN ${OPEN} AND deleted_at IS NULL
        AND id NOT IN (
          SELECT DISTINCT ON (unit_id) id
          FROM listings
          WHERE status IN ${OPEN} AND deleted_at IS NULL
          ORDER BY unit_id, (status = 'published') DESC, created_at DESC
        );
    `);

    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_open_listing_per_unit"
      ON "listings" ("unit_id")
      WHERE status IN ${OPEN} AND deleted_at IS NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_open_listing_per_unit";`);
  }
}
