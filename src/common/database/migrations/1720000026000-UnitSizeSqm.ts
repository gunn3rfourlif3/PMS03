import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unit floor area (m²). A physical attribute of the unit, surfaced on the public
 * listing so renters can see the size. Nullable — existing units are unaffected.
 */
export class UnitSizeSqm1720000026000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS size_sqm numeric`);
    await this.functions(q, true);
  }

  public async down(q: QueryRunner): Promise<void> {
    await this.functions(q, false);
    await q.query(`ALTER TABLE units DROP COLUMN IF EXISTS size_sqm`);
  }

  /** Recreate the public listing functions, with or without the size column. */
  private async functions(q: QueryRunner, withSize: boolean): Promise<void> {
    const size = withSize ? `u.size_sqm AS "sizeSqm",` : '';
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
                 ${size}
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
                 ${size}
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
}
