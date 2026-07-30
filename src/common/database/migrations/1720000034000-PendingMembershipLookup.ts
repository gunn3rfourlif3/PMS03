import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login-time helper: does this user hold a 'pending' membership (approved but
 * not yet granted access, e.g. an applicant who hasn't signed their lease)?
 * SECURITY DEFINER so the pre-auth, cross-tenant by-user_id lookup succeeds
 * despite RLS on memberships. Lets auth return an explicit "sign your lease
 * first" message instead of issuing a context-less session.
 */
export class PendingMembershipLookup1720000034000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION auth_has_pending_membership(p_user uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM memberships
          WHERE user_id = p_user AND deleted_at IS NULL AND status = 'pending'
        );
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS auth_has_pending_membership(uuid);`);
  }
}
