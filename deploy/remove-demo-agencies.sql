-- Removes the demo agencies and everything hanging off them.
--
-- Guarded to slugs starting `demo-`, in dependency order. Deliberately NOT a
-- cascade off vendors: an accidental id here should fail, not quietly delete a
-- customer. Run as psql -U pms.

BEGIN;

DELETE FROM agency_onboarding_items i
 USING vendors v WHERE v.id = i.vendor_id AND v.slug LIKE 'demo-%';

DELETE FROM vendor_subscriptions s
 USING vendors v WHERE v.id = s.vendor_id AND v.slug LIKE 'demo-%';

DELETE FROM memberships m
 USING vendors v WHERE v.id = m.vendor_id AND v.slug LIKE 'demo-%';

DELETE FROM users WHERE email LIKE 'owner@demo-%.invalid';

DELETE FROM vendors WHERE slug LIKE 'demo-%';

COMMIT;

SELECT count(*) AS demo_vendors_remaining FROM vendors WHERE slug LIKE 'demo-%';
