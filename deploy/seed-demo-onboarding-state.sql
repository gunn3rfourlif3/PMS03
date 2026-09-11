-- Puts the two demo agencies into mid-flight onboarding states.
--
-- Run AFTER pressing "Start onboarding" on both in the console — this file
-- deliberately contains no item definitions, only item KEYS. The 43 items come
-- from the live template in onboarding-template.ts, so a copy here would drift
-- from the runbook the moment either changed.
--
-- What it produces, and why each state is worth having on screen:
--
--   Northcliff — stage 2, stalled 9 days on a third party.
--     The state the portfolio view exists for. Nothing is wrong at Locare's end
--     and nobody has done anything wrong, but the onboarding has not moved in
--     over a week. It must read differently from an agency nobody has touched.
--
--   Sea Point — stage 5, one failed check, 2 days since anything moved.
--     Mid data migration: some done, one in progress, one waiting on the agency
--     and one FAILED. `failed` is deliberately distinct from `pending`, and this
--     is the row that proves the distinction shows up in the UI.
--
-- Idempotent, and scoped to slugs starting `demo-`. Run as psql -U pms.

BEGIN;

-- A 'done' item needs a person: the table refuses it otherwise. Prefer a real
-- operator so the record reads honestly; fall back to the demo owner where this
-- is running on a machine that has never seen one.
CREATE TEMP TABLE _actor ON COMMIT DROP AS
SELECT COALESCE(
  (SELECT id FROM users WHERE email = 'vernon@locare.co.za'),
  (SELECT id FROM users WHERE email LIKE 'owner@demo-%.invalid' ORDER BY email LIMIT 1)
) AS id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM agency_onboarding_items i
    JOIN vendors v ON v.id = i.vendor_id
   WHERE v.slug IN ('demo-northcliff', 'demo-seapoint');
  IF n = 0 THEN
    RAISE EXCEPTION 'No checklist items for the demo agencies. Press "Start onboarding" on both in the console first, then re-run this file.';
  END IF;
END $$;

-- ── Everything back to pending first, so re-running gives the same result.
--
-- updated_at is backdated, NOT set to now(). `daysStalled` takes the max across
-- an agency's items, so stamping all 43 with the current time would drown out
-- the few rows this file backdates and every demo agency would read as "moved
-- today". In real use untouched items keep their seed timestamp, which is what
-- makes the stall visible; this reproduces that rather than fighting it.
UPDATE agency_onboarding_items i
   SET status = 'pending', completed_at = NULL, completed_by = NULL,
       updated_at = now() - interval '30 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug LIKE 'demo-%';

-- ── Northcliff: stages 0 and 1 complete, stage 2 part-done and stuck.
UPDATE agency_onboarding_items i
   SET status = 'done', completed_by = (SELECT id FROM _actor),
       completed_at = now() - interval '21 days', updated_at = now() - interval '21 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-northcliff' AND i.stage <= 1;

UPDATE agency_onboarding_items i
   SET status = 'done', completed_by = (SELECT id FROM _actor),
       completed_at = now() - interval '9 days', updated_at = now() - interval '9 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-northcliff' AND i.item_key = '2.1-dns-records';

-- The stall itself: their DNS controller has had the records for nine days.
UPDATE agency_onboarding_items i
   SET status = 'blocked', waiting_on = 'third_party',
       notes = 'Records sent to their web developer on the 2nd. Chased twice, no reply.',
       updated_at = now() - interval '9 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-northcliff' AND i.item_key = '2.2-dns-live';

UPDATE agency_onboarding_items i
   SET status = 'failed',
       notes = 'app and portal resolve; rentals, tenant and landlord do not. NXDOMAIN.',
       updated_at = now() - interval '9 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-northcliff' AND i.item_key = '2.3-hosts-tls';

-- ── Sea Point: through stage 4, mid-migration at stage 5.
UPDATE agency_onboarding_items i
   SET status = 'done', completed_by = (SELECT id FROM _actor),
       completed_at = now() - interval '12 days', updated_at = now() - interval '12 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-seapoint' AND i.stage <= 4;

UPDATE agency_onboarding_items i
   SET status = 'done', completed_by = (SELECT id FROM _actor),
       completed_at = now() - interval '3 days', updated_at = now() - interval '3 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-seapoint' AND i.item_key = '5.1-properties';

UPDATE agency_onboarding_items i
   SET status = 'in_progress', updated_at = now() - interval '2 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-seapoint' AND i.item_key = '5.2-tenants-leases';

UPDATE agency_onboarding_items i
   SET status = 'pending', waiting_on = 'agency',
       notes = 'Waiting on their bookkeeper for arrears as at go-live.',
       updated_at = now() - interval '2 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-seapoint' AND i.item_key = '5.4-opening-balances';

UPDATE agency_onboarding_items i
   SET status = 'failed',
       notes = 'Ledger is out by R14,207.50 — two deposits loaded without a matching credit.',
       updated_at = now() - interval '2 days'
  FROM vendors v
 WHERE v.id = i.vendor_id AND v.slug = 'demo-seapoint' AND i.item_key = '5.5-reconciles';

COMMIT;

SELECT v.slug,
       min(i.stage) FILTER (WHERE i.status NOT IN ('done','skipped')) AS current_stage,
       count(*) FILTER (WHERE i.status = 'done')   AS done,
       count(*) FILTER (WHERE i.status = 'failed') AS failed,
       count(*) AS total,
       (now()::date - max(i.updated_at)::date)     AS days_stalled
  FROM agency_onboarding_items i
  JOIN vendors v ON v.id = i.vendor_id
 WHERE v.slug LIKE 'demo-%'
 GROUP BY v.slug ORDER BY v.slug;
