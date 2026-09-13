import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create a direct-sold agency from the back office (gap R-3).
 *
 * `provision_agency()` already does this for the partner channel, but it takes
 * a partner and hardcodes the starter tier — so a direct sale through it would
 * record an attribution that does not exist and a price that is probably
 * wrong. This is its sibling: no partner, no deal row, no activity, and the
 * tier and price supplied by the caller.
 *
 * SECURITY DEFINER for the same reason every other platform function is: the
 * back office has no tenant context and `vendors` is under RLS.
 *
 * The slug check lives in here rather than in the controller so two operators
 * creating the same agency at the same moment cannot both win. `vendors.slug`
 * has a unique index; this turns the raw violation into a message that names
 * what is wrong.
 */
export class CreateAgency1720000051000 implements MigrationInterface {
  name = 'CreateAgency1720000051000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_create_agency(
        p_agency         text,
        p_slug           text,
        p_owner_name     text,
        p_owner_email    text,
        p_tier           text,
        p_units          int,
        p_mrr            numeric,
        p_override       numeric DEFAULT NULL,
        p_override_reason text   DEFAULT NULL,
        p_override_until date    DEFAULT NULL
      ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_vendor uuid; v_user uuid; v_slug text;
      BEGIN
        v_slug := NULLIF(btrim(lower(p_slug)), '');
        IF v_slug IS NULL THEN
          RAISE EXCEPTION 'SLUG_REQUIRED';
        END IF;

        -- Named rather than left to the unique index, so the caller can say
        -- which agency already holds it.
        IF EXISTS (SELECT 1 FROM vendors WHERE lower(slug) = v_slug) THEN
          RAISE EXCEPTION 'SLUG_TAKEN:%', (SELECT name FROM vendors WHERE lower(slug) = v_slug LIMIT 1);
        END IF;

        INSERT INTO vendors (name, slug, type, default_currency, status)
        VALUES (p_agency, v_slug, 'agency', 'ZAR', 'active')
        RETURNING id INTO v_vendor;

        -- An owner who already exists (they may own another agency, or have
        -- been a tenant) is reused rather than duplicated. Their name is only
        -- filled in when we do not already have one.
        INSERT INTO users (name, email, status) VALUES (p_owner_name, p_owner_email, 'active')
        ON CONFLICT (email) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name)
        RETURNING id INTO v_user;
        IF v_user IS NULL THEN
          SELECT id INTO v_user FROM users WHERE email = p_owner_email;
        END IF;

        INSERT INTO memberships (vendor_id, user_id, role, scope)
        VALUES (v_vendor, v_user, 'vendor_owner', '{}')
        ON CONFLICT (vendor_id, user_id) DO NOTHING;

        -- referred_by_partner_id stays NULL. That is the whole point: a direct
        -- sale must not look like a partner's, or it pays commission forever.
        INSERT INTO vendor_subscriptions (
          vendor_id, tier, status, unit_count, mrr,
          price_override, price_override_reason, price_override_until
        )
        VALUES (
          v_vendor, p_tier, 'active', GREATEST(COALESCE(p_units, 0), 0), COALESCE(p_mrr, 0),
          p_override, NULLIF(btrim(COALESCE(p_override_reason, '')), ''), p_override_until
        )
        ON CONFLICT (vendor_id) DO NOTHING;

        RETURN v_vendor;
      END;
      $$;`);

    // A SECURITY DEFINER function is EXECUTE-able by PUBLIC unless told
    // otherwise, and this one writes vendors. Narrow it to the app role —
    // guarded, because a local dev database has no `pms_app`.
    await q.query(`
      DO $$ BEGIN
        REVOKE ALL ON FUNCTION platform_create_agency(text,text,text,text,text,int,numeric,numeric,text,date) FROM PUBLIC;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
          GRANT EXECUTE ON FUNCTION platform_create_agency(text,text,text,text,text,int,numeric,numeric,text,date) TO pms_app;
        END IF;
      END $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS platform_create_agency(text,text,text,text,text,int,numeric,numeric,text,date);`);
  }
}
