import { MigrationInterface, QueryRunner } from 'typeorm';

/** Inspections (move-in/out/periodic) as structured data, RLS-scoped. */
export class Inspections1720000011000 implements MigrationInterface {
  name = 'Inspections1720000011000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "inspections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "lease_id" uuid,
        "type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "checklist" jsonb NOT NULL DEFAULT '[]',
        "tenant_signoff" boolean NOT NULL DEFAULT false,
        "conducted_on" date,
        "report_document_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_inspections_unit" ON "inspections" ("vendor_id","unit_id");`);
    await q.query(`CREATE INDEX "ix_inspections_status" ON "inspections" ("status");`);

    await q.query(`ALTER TABLE "inspections" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "inspections" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "inspections_tenant_isolation" ON "inspections"
      USING ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid)
      WITH CHECK ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "inspections_tenant_isolation" ON "inspections";`);
    await q.query(`DROP TABLE IF EXISTS "inspections";`);
  }
}
