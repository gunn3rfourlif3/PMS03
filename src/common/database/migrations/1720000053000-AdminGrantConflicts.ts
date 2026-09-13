import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What an address would LOSE by being made a platform admin.
 *
 * `issueForUser()` resolves a sign-in context in priority order — platform
 * admin, then partner, then vendor membership — and returns at the first match
 * with `vendorId: null`. So granting operator access to someone who already
 * uses Locare as a tenant, an agency owner or a partner silently takes that
 * access away: the next time they sign in they get the back office and nothing
 * else.
 *
 * That behaviour predates R-2, but the Operators screen makes it easy to hit by
 * accident — the obvious person to grant access to is an agency owner who is
 * helping with an onboarding. Until account switching exists, the honest fix is
 * to say so before the grant, which is what this function feeds.
 */
export class AdminGrantConflicts1720000053000 implements MigrationInterface {
  name = 'AdminGrantConflicts1720000053000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_admin_conflicts(p_email text)
      RETURNS TABLE ("kind" text, "label" text, "role" text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        WITH u AS (
          SELECT id FROM users
           WHERE lower(email) = lower(btrim(coalesce(p_email, '')))
             AND btrim(coalesce(p_email, '')) <> ''
        )
        SELECT 'agency'::text, v.name::text, m.role::text
          FROM memberships m
          JOIN u ON u.id = m.user_id
          JOIN vendors v ON v.id = m.vendor_id
        UNION ALL
        SELECT 'partner'::text, p.name::text, pm.role::text
          FROM partner_members pm
          JOIN u ON u.id = pm.user_id
          JOIN partners p ON p.id = pm.partner_id;
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS platform_admin_conflicts(text);`);
  }
}
