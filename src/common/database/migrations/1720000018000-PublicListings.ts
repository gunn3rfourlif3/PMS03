import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public rentals site support.
 *  - applications.details: rich applicant info captured by the public apply form
 *    (income, employment, move-in date, occupants, consent, etc.).
 *  - public_listings(key):  SECURITY DEFINER browse of a vendor's PUBLISHED
 *    listings, resolved by slug OR custom_domain (so rentals.<domain> works).
 *  - public_listing(id):    SECURITY DEFINER single published listing detail.
 * Both bypass RLS (there's no auth/tenant context on the public site) but only
 * ever expose published listings for active vendors.
 */
export class PublicListings1720000018000 implements MigrationInterface {
  name = 'PublicListings1720000018000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "details" jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    );

    await q.query(`
      CREATE OR REPLACE FUNCTION public_listings(p_key text)
      RETURNS json
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x."availableFrom"), '[]'::json)
        FROM (
          SELECT l.id,
                 l.advertised_rent AS "rent",
                 l.available_from  AS "availableFrom",
                 l.description,
                 l.media,
                 u.label     AS "unitLabel",
                 u.bedrooms, u.bathrooms,
                 pr.name     AS "propertyName",
                 pr.address  AS "address",
                 pr.type     AS "propertyType"
          FROM listings l
          JOIN vendors v     ON v.id = l.vendor_id
          JOIN units u       ON u.id = l.unit_id
          JOIN properties pr ON pr.id = u.property_id
          WHERE l.status = 'published'
            AND v.status = 'active'
            AND (v.slug = p_key OR v.custom_domain = p_key)
        ) x;
      $$;
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION public_listing(p_id uuid)
      RETURNS json
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT row_to_json(x)
        FROM (
          SELECT l.id,
                 l.advertised_rent AS "rent",
                 l.available_from  AS "availableFrom",
                 l.description,
                 l.media,
                 u.label     AS "unitLabel",
                 u.bedrooms, u.bathrooms,
                 pr.name     AS "propertyName",
                 pr.address  AS "address",
                 pr.type     AS "propertyType",
                 v.name      AS "vendorName",
                 v.slug      AS "vendorSlug"
          FROM listings l
          JOIN vendors v     ON v.id = l.vendor_id
          JOIN units u       ON u.id = l.unit_id
          JOIN properties pr ON pr.id = u.property_id
          WHERE l.id = p_id AND l.status = 'published' AND v.status = 'active'
          LIMIT 1
        ) x;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS public_listing(uuid);`);
    await q.query(`DROP FUNCTION IF EXISTS public_listings(text);`);
    await q.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "details";`);
  }
}
