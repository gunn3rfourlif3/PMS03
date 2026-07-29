import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partner programme (software resellers). PLATFORM-SCOPED tables — no RLS, because
 * a partner spans many agencies. Access is scoped at the app layer by partner_id
 * (PartnerContext) / platform_admin role.
 *
 * Also ships two SECURITY DEFINER functions:
 *  - partner_leaderboard(): safe read-only cross-partner aggregate for the board.
 *  - provision_agency(...): atomically create a vendor + owner + subscription
 *    attributed to a partner, bypassing RLS (the app role can't write vendor/
 *    membership rows without a vendor context).
 */
export class Partners1720000028000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        contact_email text,
        contact_phone text,
        company text,
        ref_code text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending',
        commission_rate numeric NOT NULL DEFAULT 0.10,
        commission_months int,
        banking jsonb NOT NULL DEFAULT '{}'::jsonb,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS partner_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role text NOT NULL DEFAULT 'partner_owner',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (partner_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS partner_members_user_idx ON partner_members(user_id);`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS partner_deals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL,
        prospect_name text NOT NULL,
        contact_name text,
        contact_email text,
        contact_phone text,
        stage text NOT NULL DEFAULT 'lead',
        expected_units int NOT NULL DEFAULT 0,
        expected_mrr numeric NOT NULL DEFAULT 0,
        source text NOT NULL DEFAULT 'manual',
        lost_reason text,
        vendor_id uuid,
        stage_changed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS partner_deals_partner_idx ON partner_deals(partner_id, stage);`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS partner_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner_id uuid NOT NULL,
        deal_id uuid,
        type text NOT NULL,
        summary text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS partner_activities_partner_idx ON partner_activities(partner_id, created_at DESC);`);

    await q.query(`
      CREATE OR REPLACE FUNCTION partner_leaderboard()
      RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x."referredMrr" DESC, x."agenciesSigned" DESC), '[]'::json)
        FROM (
          SELECT p.id AS "partnerId", p.name,
                 COALESCE(s.agencies, 0)   AS "agenciesSigned",
                 COALESCE(s.mrr, 0)        AS "referredMrr",
                 COALESCE(d.won, 0)        AS "dealsWon"
          FROM partners p
          LEFT JOIN (
            SELECT referred_by_partner_id AS pid, COUNT(*) AS agencies, SUM(mrr) AS mrr
            FROM vendor_subscriptions
            WHERE referred_by_partner_id IS NOT NULL AND status IN ('active','trialing')
            GROUP BY referred_by_partner_id
          ) s ON s.pid = p.id
          LEFT JOIN (
            SELECT partner_id AS pid, COUNT(*) AS won FROM partner_deals WHERE stage = 'won' GROUP BY partner_id
          ) d ON d.pid = p.id
          WHERE p.status = 'active'
        ) x;
      $$;`);

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
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS provision_agency(uuid, text, text, text, text);`);
    await q.query(`DROP FUNCTION IF EXISTS partner_leaderboard();`);
    await q.query(`DROP TABLE IF EXISTS partner_activities;`);
    await q.query(`DROP TABLE IF EXISTS partner_deals;`);
    await q.query(`DROP TABLE IF EXISTS partner_members;`);
    await q.query(`DROP TABLE IF EXISTS partners;`);
  }
}
