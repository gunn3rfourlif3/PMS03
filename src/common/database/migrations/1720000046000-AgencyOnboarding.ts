import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-agency onboarding checklist (requirements doc R-7).
 *
 * Platform-scoped, like `vendor_subscriptions`: no RLS, because the only readers
 * are platform admins running onboardings across agencies. App-layer code scopes
 * by vendor_id and the controller is `@Roles('platform_admin')`.
 *
 * `template_version` exists so that editing the runbook does not rewrite the
 * history of an onboarding already in flight. Items are seeded from a versioned
 * template; a template change applies to agencies seeded after it.
 *
 * `evidence` holds whatever proved an item — a check result and its timestamp —
 * so that a year later "TLS was fine on the 4th" is a record rather than a
 * memory. Phase 1 leaves it null; the verification checks (R-9) fill it.
 */
export class AgencyOnboarding1720000046000 implements MigrationInterface {
  name = 'AgencyOnboarding1720000046000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS agency_onboarding_items (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id        uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        template_version text NOT NULL,
        stage            int  NOT NULL,
        item_key         text NOT NULL,
        title            text NOT NULL,
        detail           text,
        status           text NOT NULL DEFAULT 'pending',
        waiting_on       text NOT NULL DEFAULT 'locare',
        verifiable       boolean NOT NULL DEFAULT false,
        weight_hours     numeric NOT NULL DEFAULT 0,
        owner_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
        completed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
        completed_at     timestamptz,
        evidence         jsonb,
        notes            text,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      );`);

    // One row per item per agency. Seeding is idempotent because of this.
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_onboarding_vendor_item
        ON agency_onboarding_items (vendor_id, item_key);`);

    // The portfolio view reads "everything not finished, oldest first".
    await q.query(`
      CREATE INDEX IF NOT EXISTS ix_onboarding_open
        ON agency_onboarding_items (vendor_id, stage)
        WHERE status <> 'done' AND status <> 'skipped';`);

    await q.query(`
      ALTER TABLE agency_onboarding_items
        DROP CONSTRAINT IF EXISTS agency_onboarding_items_status;`);
    await q.query(`
      ALTER TABLE agency_onboarding_items
        ADD CONSTRAINT agency_onboarding_items_status
        CHECK (status IN ('pending','in_progress','blocked','done','skipped','failed'));`);

    await q.query(`
      ALTER TABLE agency_onboarding_items
        DROP CONSTRAINT IF EXISTS agency_onboarding_items_waiting_on;`);
    await q.query(`
      ALTER TABLE agency_onboarding_items
        ADD CONSTRAINT agency_onboarding_items_waiting_on
        CHECK (waiting_on IN ('locare','agency','third_party'));`);

    // A completed item must say who completed it. Without this, "done" decays
    // into an anonymous tick and the handover problem comes straight back.
    await q.query(`
      ALTER TABLE agency_onboarding_items
        DROP CONSTRAINT IF EXISTS agency_onboarding_items_completion;`);
    await q.query(`
      ALTER TABLE agency_onboarding_items
        ADD CONSTRAINT agency_onboarding_items_completion
        CHECK (status <> 'done' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL));`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS agency_onboarding_items;`);
  }
}
