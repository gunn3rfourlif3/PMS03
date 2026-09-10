import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the onboarding console actually readable by the app.
 *
 * Two things were missing, and both are consequences of the app connecting as
 * `pms_app` — the least-privileged role — rather than as the owner:
 *
 *  1. **No grant.** Tables are not readable by `pms_app` unless a migration says
 *     so (see the impersonation_events grant in 1720000036000). Without this the
 *     first real read fails with "permission denied for table".
 *
 *  2. **RLS on `vendors`.** The console is platform-wide: it looks at agencies
 *     without being inside any one agency's tenant context, so every direct
 *     read of `vendors` returns nothing and the API reports "Agency not found".
 *     That is what `platform_agencies()` already exists to solve for the
 *     impersonation screen; this adds the single-agency equivalent.
 *
 * The returned columns are QUOTED camelCase on purpose. `platform_agencies()`
 * declares them unquoted, so Postgres folds them to snake_case while the
 * TypeScript signature promised camelCase — a mismatch the compiler cannot see
 * through a raw query, and one that shipped `undefined` into a uuid parameter.
 * Quoting here means the row that comes back is already the shape the caller
 * declares.
 */
export class AgencyOnboardingAccess1720000047000 implements MigrationInterface {
  name = 'AgencyOnboardingAccess1720000047000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON agency_onboarding_items TO pms_app;
      END IF;
    END $$;`);

    // One agency, by id, bypassing RLS for the platform console.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_agency(p_vendor uuid)
      RETURNS TABLE("vendorId" uuid, name text, slug text, status text, "customDomain" text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT id, name, slug, status, custom_domain FROM vendors WHERE id = p_vendor;
      $$;`);

    // Every agency that has an onboarding checklist, for the portfolio view.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_onboarding_agencies()
      RETURNS TABLE("vendorId" uuid, name text, slug text, status text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT v.id, v.name, v.slug, v.status
          FROM vendors v
         WHERE EXISTS (SELECT 1 FROM agency_onboarding_items i WHERE i.vendor_id = v.id)
         ORDER BY v.name;
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS platform_onboarding_agencies();`);
    await q.query(`DROP FUNCTION IF EXISTS platform_agency(uuid);`);
  }
}
