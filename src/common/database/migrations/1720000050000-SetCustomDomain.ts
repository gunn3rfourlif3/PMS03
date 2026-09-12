import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Setting an agency's custom domain from the platform console (gap R-4).
 *
 * SECURITY DEFINER because the console runs outside any tenant context, so a
 * direct UPDATE on `vendors` is invisible to RLS and silently affects no rows —
 * the same trap that made the onboarding console report "Agency not found".
 *
 * The function refuses a domain already claimed by a different vendor. That
 * check has to live here rather than in the service: two operators setting the
 * same domain at the same moment would both read "free" and both write, and the
 * loser would own a domain whose certificate the winner's agency answers for.
 * A unique index cannot express it either, because NULL custom_domain is the
 * normal state for most vendors.
 */
export class SetCustomDomain1720000050000 implements MigrationInterface {
  name = 'SetCustomDomain1720000050000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_set_custom_domain(p_vendor uuid, p_domain text)
      RETURNS TABLE("vendorId" uuid, name text, slug text, "customDomain" text)
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_domain text := nullif(btrim(lower(p_domain)), '');
              v_taken  text;
      BEGIN
        IF v_domain IS NOT NULL THEN
          SELECT v.name INTO v_taken
            FROM vendors v
           WHERE lower(v.custom_domain) = v_domain AND v.id <> p_vendor
           LIMIT 1;
          IF v_taken IS NOT NULL THEN
            RAISE EXCEPTION 'DOMAIN_TAKEN:%', v_taken USING ERRCODE = '23505';
          END IF;
        END IF;

        UPDATE vendors SET custom_domain = v_domain, updated_at = now()
         WHERE id = p_vendor;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'VENDOR_NOT_FOUND';
        END IF;

        RETURN QUERY
          SELECT v.id, v.name, v.slug, v.custom_domain FROM vendors v WHERE v.id = p_vendor;
      END;
      $$;`);

    // Finding who already holds a domain is a platform question, and `vendors`
    // is invisible from outside a tenant context.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_domain_holder(p_domain text)
      RETURNS TABLE("vendorId" uuid, name text, slug text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT id, name, slug FROM vendors
         WHERE lower(custom_domain) = nullif(btrim(lower(p_domain)), '');
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS platform_domain_holder(text);`);
    await q.query(`DROP FUNCTION IF EXISTS platform_set_custom_domain(uuid, text);`);
  }
}
