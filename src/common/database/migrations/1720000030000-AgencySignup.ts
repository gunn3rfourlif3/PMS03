import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3: referral self-signup (admin-approved) + a vendor_name() lookup.
 *
 * `vendors` has FORCE RLS, so the platform layer can't read a vendor's name
 * across tenants by a plain join. vendor_name() is a SECURITY DEFINER scalar the
 * partner/admin queries use instead of joining `vendors`.
 *
 * signup_agency() creates a PENDING agency attributed to a partner (by ref code);
 * approve_agency() activates it. Both bypass RLS via SECURITY DEFINER.
 */
export class AgencySignup1720000030000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION vendor_name(p uuid)
      RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT name FROM vendors WHERE id = p;
      $$;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION signup_agency(p_ref text, p_agency text, p_owner_name text, p_owner_email text)
      RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_partner uuid; v_vendor uuid; v_user uuid;
      BEGIN
        SELECT id INTO v_partner FROM partners WHERE ref_code = p_ref AND status = 'active';
        IF v_partner IS NULL THEN RAISE EXCEPTION 'Invalid or inactive referral code'; END IF;

        INSERT INTO vendors (name, type, default_currency, status)
        VALUES (p_agency, 'agency', 'ZAR', 'pending') RETURNING id INTO v_vendor;

        INSERT INTO users (name, email) VALUES (p_owner_name, lower(p_owner_email))
        ON CONFLICT (email) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name) RETURNING id INTO v_user;
        IF v_user IS NULL THEN SELECT id INTO v_user FROM users WHERE email = lower(p_owner_email); END IF;

        INSERT INTO memberships (vendor_id, user_id, role, scope)
        VALUES (v_vendor, v_user, 'vendor_owner', '{}') ON CONFLICT (vendor_id, user_id) DO NOTHING;

        INSERT INTO vendor_subscriptions (vendor_id, tier, status, referred_by_partner_id)
        VALUES (v_vendor, 'starter', 'pending', v_partner) ON CONFLICT (vendor_id) DO NOTHING;

        INSERT INTO partner_deals (partner_id, prospect_name, contact_email, stage, source, vendor_id, stage_changed_at)
        VALUES (v_partner, p_agency, lower(p_owner_email), 'proposal', 'referral_link', v_vendor, now());

        INSERT INTO partner_activities (partner_id, type, summary)
        VALUES (v_partner, 'signup', 'Referral signup: ' || p_agency);

        RETURN v_vendor;
      END; $$;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION approve_agency(p_vendor uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        UPDATE vendor_subscriptions SET status = 'active', updated_at = now() WHERE vendor_id = p_vendor;
        UPDATE vendors SET status = 'active', updated_at = now() WHERE id = p_vendor;
        UPDATE partner_deals SET stage = 'won', stage_changed_at = now() WHERE vendor_id = p_vendor AND stage <> 'won';
      END; $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS approve_agency(uuid);`);
    await q.query(`DROP FUNCTION IF EXISTS signup_agency(text, text, text, text);`);
    await q.query(`DROP FUNCTION IF EXISTS vendor_name(uuid);`);
  }
}
