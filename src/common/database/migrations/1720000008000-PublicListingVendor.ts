import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public application submission has no vendor context (no auth), but the
 * applications table is vendor-scoped. This SECURITY DEFINER function resolves
 * the owning vendor of a *published* listing so the app can attach the new
 * application to the right vendor and insert it under that vendor's context.
 */
export class PublicListingVendor1720000008000 implements MigrationInterface {
  name = 'PublicListingVendor1720000008000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION public_listing_vendor(p_listing uuid)
      RETURNS uuid
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT vendor_id FROM listings
        WHERE id = p_listing AND status = 'published' AND deleted_at IS NULL;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS public_listing_vendor(uuid);`);
  }
}
