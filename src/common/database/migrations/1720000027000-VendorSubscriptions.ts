import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0 of the Partner programme: vendor subscriptions (Starter/Growth/
 * Enterprise) — the software revenue partners later earn commission on.
 *
 * PLATFORM-SCOPED, NO RLS: a subscription is about a whole agency and is read
 * across vendors by the platform layer, so RLS is intentionally NOT enabled on
 * this table (unlike operational tenant tables). App-layer code always scopes by
 * vendor_id. Table grants to pms_app come from the deploy's default privileges,
 * same as every other migration.
 */
export class VendorSubscriptions1720000027000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS vendor_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id uuid NOT NULL UNIQUE,
        tier text NOT NULL DEFAULT 'starter',
        status text NOT NULL DEFAULT 'active',
        unit_count int NOT NULL DEFAULT 0,
        mrr numeric NOT NULL DEFAULT 0,
        referred_by_partner_id uuid,
        current_period text,
        started_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    // SECURITY DEFINER count so platform-level code (monthly job, admin) can size a
    // vendor's plan without a per-vendor RLS context. Mirrors public_listings.
    await q.query(`
      CREATE OR REPLACE FUNCTION vendor_active_unit_count(p_vendor uuid)
      RETURNS int
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT COUNT(*)::int FROM units WHERE vendor_id = p_vendor AND deleted_at IS NULL;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS vendor_active_unit_count(uuid);`);
    await q.query(`DROP TABLE IF EXISTS vendor_subscriptions;`);
  }
}
