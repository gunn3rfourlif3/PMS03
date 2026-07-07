import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner banking details (for payouts) + a vendor-scoped service-provider
 * directory (maintenance, landscaping, cleaning, legal, security, ...).
 */
export class ProvidersAndBanking1720000015000 implements MigrationInterface {
  name = 'ProvidersAndBanking1720000015000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "banking" jsonb NOT NULL DEFAULT '{}';`);

    await q.query(`
      CREATE TABLE "service_providers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "category" text NOT NULL,
        "contact_name" varchar,
        "phone" varchar,
        "email" varchar,
        "notes" text,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_providers_category" ON "service_providers" ("vendor_id","category");`);
    await q.query(`CREATE INDEX "ix_providers_status" ON "service_providers" ("status");`);

    await q.query(`ALTER TABLE "service_providers" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "service_providers" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "service_providers_tenant_isolation" ON "service_providers"
      USING ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid)
      WITH CHECK ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "service_providers_tenant_isolation" ON "service_providers";`);
    await q.query(`DROP TABLE IF EXISTS "service_providers";`);
    await q.query(`ALTER TABLE "owners" DROP COLUMN IF EXISTS "banking";`);
  }
}
