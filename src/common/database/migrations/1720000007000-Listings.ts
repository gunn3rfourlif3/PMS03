import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Listings + applications (the vacancy → lease funnel), RLS-scoped. Also adds
 * leases.tenant_id (populated on approval) and updates billing_active_leases to
 * carry the tenant through to invoice generation + notifications.
 */
export class Listings1720000007000 implements MigrationInterface {
  name = 'Listings1720000007000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "leases" ADD COLUMN "tenant_id" uuid;`);

    await q.query(`
      CREATE TABLE "listings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "advertised_rent" numeric NOT NULL,
        "available_from" date NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "description" varchar,
        "media" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_listings_status" ON "listings" ("status");`);

    await q.query(`
      CREATE TABLE "applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "applicant_name" varchar NOT NULL,
        "applicant_email" varchar NOT NULL,
        "applicant_phone" varchar,
        "status" text NOT NULL DEFAULT 'submitted',
        "screening_result" jsonb,
        "lease_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_applications_status" ON "applications" ("status");`);

    for (const table of ['listings', 'applications']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
        WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
      `);
    }

    // Carry tenant_id through the billing worklist now that leases have it.
    await q.query(`
      CREATE OR REPLACE FUNCTION billing_active_leases(p_period text)
      RETURNS TABLE(vendor_id uuid, lease_id uuid, tenant_id uuid, rent_amount numeric)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT l.vendor_id, l.id AS lease_id, l.tenant_id, l.rent_amount
        FROM leases l
        WHERE l.status = 'active'
          AND l.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.lease_id = l.id AND i.period = p_period
          );
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Restore the prior worklist (tenant_id as NULL).
    await q.query(`
      CREATE OR REPLACE FUNCTION billing_active_leases(p_period text)
      RETURNS TABLE(vendor_id uuid, lease_id uuid, tenant_id uuid, rent_amount numeric)
      LANGUAGE sql SECURITY DEFINER SET search_path = public
      AS $$
        SELECT l.vendor_id, l.id, NULL::uuid, l.rent_amount
        FROM leases l
        WHERE l.status = 'active' AND l.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.lease_id = l.id AND i.period = p_period);
      $$;
    `);
    for (const table of ['listings', 'applications']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "applications";`);
    await q.query(`DROP TABLE IF EXISTS "listings";`);
    await q.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "tenant_id";`);
  }
}
