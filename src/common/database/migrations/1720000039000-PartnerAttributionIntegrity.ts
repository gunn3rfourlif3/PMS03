import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two attribution defects found while reviewing the commission structure
 * against the code that implements it.
 *
 * 1. `provision_agency()` upserted `referred_by_partner_id` with DO UPDATE, so
 *    a second partner onboarding an agency that already existed silently took
 *    over attribution — and with it, lifetime commission on someone else's
 *    referral. The published terms say the first recorded referral wins.
 *    `signup_agency()` already did the right thing (DO NOTHING); this brings
 *    the other path in line.
 *
 * 2. `vendor_subscriptions.started_at` defaults to now() at INSERT, which for a
 *    referral signup is the moment the form is submitted — while the row is
 *    still `pending`. Accrual only runs on `active`/`trialing`, so an
 *    Introducer's 24-month window was being consumed by an approval delay they
 *    have no control over. `approve_agency()` now stamps `started_at` at
 *    activation, which is when commission can first accrue.
 *
 * Both functions are SECURITY DEFINER and bypass RLS by design — they run
 * before any vendor context exists. Only the two clauses noted above change;
 * the bodies are otherwise reproduced verbatim from
 * 1720000028000-Partners.ts and 1720000030000-AgencySignup.ts.
 */
export class PartnerAttributionIntegrity1720000039000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION provision_agency(
        p_partner uuid, p_agency text, p_slug text, p_owner_name text, p_owner_email text
      ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_vendor uuid; v_user uuid;
      BEGIN
        INSERT INTO vendors (name, slug, type, default_currency, status)
        VALUES (p_agency, NULLIF(p_slug,''), 'agency', 'ZAR', 'active')
        RETURNING id INTO v_vendor;

        INSERT INTO users (name, email) VALUES (p_owner_name, p_owner_email)
        ON CONFLICT (email) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name)
        RETURNING id INTO v_user;
        IF v_user IS NULL THEN SELECT id INTO v_user FROM users WHERE email = p_owner_email; END IF;

        INSERT INTO memberships (vendor_id, user_id, role, scope)
        VALUES (v_vendor, v_user, 'vendor_owner', '{}')
        ON CONFLICT (vendor_id, user_id) DO NOTHING;

        -- First referral recorded wins. Was DO UPDATE, which let a later
        -- partner overwrite an earlier one's attribution.
        INSERT INTO vendor_subscriptions (vendor_id, tier, status, referred_by_partner_id)
        VALUES (v_vendor, 'starter', 'active', p_partner)
        ON CONFLICT (vendor_id) DO NOTHING;

        RETURN v_vendor;
      END;
      $$;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION approve_agency(p_vendor uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        -- started_at is the commission clock. Stamp it when the subscription
        -- actually goes live, not when the signup form was submitted. Only on
        -- the pending → active transition, so re-approving is idempotent and
        -- cannot restart an Introducer's 24-month window.
        UPDATE vendor_subscriptions
           SET status = 'active',
               started_at = CASE WHEN status = 'pending' THEN now() ELSE started_at END,
               updated_at = now()
         WHERE vendor_id = p_vendor;
        UPDATE vendors SET status = 'active', updated_at = now() WHERE id = p_vendor;
        UPDATE partner_deals SET stage = 'won', stage_changed_at = now() WHERE vendor_id = p_vendor AND stage <> 'won';
      END; $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION provision_agency(
        p_partner uuid, p_agency text, p_slug text, p_owner_name text, p_owner_email text
      ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_vendor uuid; v_user uuid;
      BEGIN
        INSERT INTO vendors (name, slug, type, default_currency, status)
        VALUES (p_agency, NULLIF(p_slug,''), 'agency', 'ZAR', 'active')
        RETURNING id INTO v_vendor;

        INSERT INTO users (name, email) VALUES (p_owner_name, p_owner_email)
        ON CONFLICT (email) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name)
        RETURNING id INTO v_user;
        IF v_user IS NULL THEN SELECT id INTO v_user FROM users WHERE email = p_owner_email; END IF;

        INSERT INTO memberships (vendor_id, user_id, role, scope)
        VALUES (v_vendor, v_user, 'vendor_owner', '{}')
        ON CONFLICT (vendor_id, user_id) DO NOTHING;

        INSERT INTO vendor_subscriptions (vendor_id, tier, status, referred_by_partner_id)
        VALUES (v_vendor, 'starter', 'active', p_partner)
        ON CONFLICT (vendor_id) DO UPDATE SET referred_by_partner_id = EXCLUDED.referred_by_partner_id;

        RETURN v_vendor;
      END;
      $$;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION approve_agency(p_vendor uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        UPDATE vendor_subscriptions SET status = 'active', updated_at = now() WHERE vendor_id = p_vendor;
        UPDATE vendors SET status = 'active', updated_at = now() WHERE id = p_vendor;
        UPDATE partner_deals SET stage = 'won', stage_changed_at = now() WHERE vendor_id = p_vendor AND stage <> 'won';
      END; $$;`);
  }
}
