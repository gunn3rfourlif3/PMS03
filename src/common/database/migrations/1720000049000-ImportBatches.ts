import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agency data imports (requirements doc R-5).
 *
 * One row per uploaded file, carrying it through upload -> mapping -> dry run
 * -> commit. Platform-scoped like the onboarding checklist: the only readers are
 * platform admins running an onboarding, and the controller is
 * `@Roles('platform_admin')`.
 *
 * `source` holds the uploaded bytes. Kept in the row rather than in media
 * storage because the file lives for minutes, is read several times during
 * mapping and dry runs, and must be destroyable in one statement — these files
 * contain other people's personal information (tenant contact details, owners'
 * banking) and POPIA makes holding them longer than needed a liability rather
 * than a convenience. It is nulled on commit or discard and purged after 7 days.
 *
 * `source_digest` is what lets a commit refuse a file that changed after it was
 * reviewed: nobody should be able to approve one set of numbers and post another.
 */
export class ImportBatches1720000049000 implements MigrationInterface {
  name = 'ImportBatches1720000049000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        entity         text NOT NULL,
        status         text NOT NULL DEFAULT 'mapping',
        filename       text NOT NULL,
        sheet_name     text,
        source         bytea,
        source_digest  text NOT NULL,
        headers        jsonb NOT NULL DEFAULT '[]',
        mapping        jsonb NOT NULL DEFAULT '{}',
        report         jsonb,
        row_count      int NOT NULL DEFAULT 0,
        uploaded_by    uuid REFERENCES users(id) ON DELETE SET NULL,
        committed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
        committed_at   timestamptz,
        ledger_batch_ref text,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      );`);

    await q.query(`
      CREATE INDEX IF NOT EXISTS ix_import_batches_vendor
        ON import_batches (vendor_id, created_at DESC);`);

    await q.query(`
      ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_status;`);
    await q.query(`
      ALTER TABLE import_batches ADD CONSTRAINT import_batches_status
        CHECK (status IN ('mapping','dry_run','committed','discarded'));`);

    await q.query(`
      ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_entity;`);
    await q.query(`
      ALTER TABLE import_batches ADD CONSTRAINT import_batches_entity
        CHECK (entity IN ('owners','properties','units','tenants','leases','deposits','opening_balances'));`);

    // A committed batch must say who committed it and when — the same rule the
    // onboarding checklist uses, for the same reason: an anonymous "done" is
    // useless to whoever picks this up next.
    await q.query(`
      ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_committed;`);
    await q.query(`
      ALTER TABLE import_batches ADD CONSTRAINT import_batches_committed
        CHECK (status <> 'committed' OR (committed_at IS NOT NULL AND committed_by IS NOT NULL));`);

    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON import_batches TO pms_app;
      END IF;
    END $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS import_batches;`);
  }
}
