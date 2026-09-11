-- Two demo agencies for testing the onboarding console mid-flight.
--
-- The console cannot be tested against Dantalan alone: a completed onboarding
-- exercises none of the states that matter — a locked stage, a failed check, an
-- onboarding stalled on somebody else. These two exist to produce those.
--
-- SAFETY, in order of how badly each would hurt:
--   * Subscriptions are `trialing`, never `active`. SubscriptionBillingService
--     .generate() selects on status = 'active', so these can never be invoiced
--     however their unit counts or mrr move.
--   * Owner emails use the .invalid TLD (RFC 2606), which cannot resolve. If
--     anything ever tries to email them it fails at DNS rather than reaching a
--     real person.
--   * Every slug is prefixed `demo-`, which is what the teardown script keys on.
--   * Names carry "(demo)" so nobody mistakes one for a customer in the agency
--     list or an impersonation prompt.
--
-- Idempotent: safe to run twice. Run as the owner role (psql -U pms), which
-- bypasses RLS.
--
-- Usage:
--   1. psql -f deploy/seed-demo-agencies.sql
--   2. In the console, open each demo agency and press "Start onboarding"
--      (seeds the 43 items from the LIVE template — which is why this file does
--      not contain them; a copy here would drift from the runbook).
--   3. psql -f deploy/seed-demo-onboarding-state.sql

BEGIN;

-- ── Northcliff: 48 units, so Custom tier. Will be parked at stage 2, stuck on
-- a DNS controller who has not added the records.
INSERT INTO vendors (name, slug, type, default_currency, status, custom_domain)
VALUES ('Northcliff Letting (demo)', 'demo-northcliff', 'agency', 'ZAR', 'active', NULL)
ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE SET name = EXCLUDED.name;

-- ── Sea Point: 210 units, so Growth. Will be mid data migration at stage 5.
INSERT INTO vendors (name, slug, type, default_currency, status, custom_domain)
VALUES ('Sea Point Rentals (demo)', 'demo-seapoint', 'agency', 'ZAR', 'active', NULL)
ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (name, email, status) VALUES
  ('Thandi Mokoena (demo)', 'owner@demo-northcliff.invalid', 'active'),
  ('Riaan de Villiers (demo)', 'owner@demo-seapoint.invalid', 'active')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO memberships (vendor_id, user_id, role, scope)
SELECT v.id, u.id, 'vendor_owner', '{}'
  FROM vendors v
  JOIN users u ON u.email = 'owner@' || v.slug || '.invalid'
 WHERE v.slug IN ('demo-northcliff', 'demo-seapoint')
ON CONFLICT (vendor_id, user_id) DO NOTHING;

-- `trialing`, deliberately. This is the line that keeps a demo agency out of the
-- billing run on the 1st.
INSERT INTO vendor_subscriptions (vendor_id, tier, status, unit_count, mrr, current_period)
SELECT v.id,
       CASE v.slug WHEN 'demo-northcliff' THEN 'custom' ELSE 'growth' END,
       'trialing',
       CASE v.slug WHEN 'demo-northcliff' THEN 48 ELSE 210 END,
       CASE v.slug WHEN 'demo-northcliff' THEN 4124 ELSE 12600 END,
       to_char(now(), 'YYYY-MM')
  FROM vendors v
 WHERE v.slug IN ('demo-northcliff', 'demo-seapoint')
ON CONFLICT (vendor_id) DO UPDATE
  SET tier = EXCLUDED.tier, status = 'trialing',
      unit_count = EXCLUDED.unit_count, mrr = EXCLUDED.mrr;

COMMIT;

SELECT v.slug, v.name, s.tier, s.status AS sub_status, s.unit_count, s.mrr
  FROM vendors v JOIN vendor_subscriptions s ON s.vendor_id = v.id
 WHERE v.slug LIKE 'demo-%' ORDER BY v.slug;
