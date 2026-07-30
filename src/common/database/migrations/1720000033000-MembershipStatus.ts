import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gate app access behind lease signing. A membership now carries a status:
 *   - 'active'  : the user can sign in and use the app for that vendor.
 *   - 'pending' : the user is approved but has NOT yet signed their lease, so
 *                 they hold no access until it is signed.
 *
 * Existing memberships default to 'active' (no behaviour change for them).
 * auth_memberships_for_user (the SECURITY DEFINER lookup used at login) is
 * narrowed to return only active memberships, so a pending tenant resolves to
 * no vendor context and cannot enter the app.
 */
export class MembershipStatus1720000033000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE memberships
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';`);

    await q.query(`
      CREATE OR REPLACE FUNCTION auth_memberships_for_user(p_user uuid)
      RETURNS TABLE(vendor_id uuid, role text)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT vendor_id, role
        FROM memberships
        WHERE user_id = p_user AND deleted_at IS NULL AND status = 'active'
        ORDER BY created_at ASC;
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION auth_memberships_for_user(p_user uuid)
      RETURNS TABLE(vendor_id uuid, role text)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT vendor_id, role
        FROM memberships
        WHERE user_id = p_user AND deleted_at IS NULL
        ORDER BY created_at ASC;
      $$;`);
    await q.query(`ALTER TABLE memberships DROP COLUMN IF EXISTS status;`);
  }
}
