import { MigrationInterface, QueryRunner } from 'typeorm';

/** Parsed lease documents (Smart Lease Parsing) awaiting staff verification. */
export class LeaseExtractions1720000023000 implements MigrationInterface {
  name = 'LeaseExtractions1720000023000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "lease_extractions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "source_url" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'parsed',
        "provider" varchar,
        "extracted" jsonb NOT NULL DEFAULT '{}',
        "confidence" numeric,
        "error" text,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_lease_extractions_status" ON "lease_extractions" ("vendor_id", "status");`);

    await q.query(`ALTER TABLE "lease_extractions" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "lease_extractions" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "lease_extractions_tenant_isolation" ON "lease_extractions"
      USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
      WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "lease_extractions_tenant_isolation" ON "lease_extractions";`);
    await q.query(`DROP TABLE IF EXISTS "lease_extractions";`);
  }
}
