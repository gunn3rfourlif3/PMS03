import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pre-auth lookup for the "resend my signing link" path.
 *
 * A tenant blocked at login by `auth_has_pending_membership` has no session and
 * therefore no vendor context, so the unsigned agreement cannot be read through
 * RLS the normal way. This is the same SECURITY DEFINER shape as
 * `public_lease_agreement(ref)`, keyed on the user instead of the ref.
 *
 * It returns the vendor and the EXISTING ref — resending must never mint a new
 * one, or every link already in the tenant's inbox stops working.
 *
 * Deliberately narrow: only an unsigned agreement belonging to a user who holds
 * a pending membership in that same vendor. It exposes no email address and no
 * document, so a caller learns nothing about a user it guessed at beyond what
 * it already supplied.
 */
export class PendingSigningLinkLookup1720000054000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION auth_pending_signing_link(p_user uuid)
      RETURNS jsonb
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT jsonb_build_object('vendorId', la.vendor_id, 'ref', la.ref)
        FROM lease_agreements la
        JOIN memberships m
          ON m.user_id = la.tenant_id
         AND m.vendor_id = la.vendor_id
         AND m.status = 'pending'
         AND m.deleted_at IS NULL
        WHERE la.tenant_id = p_user
          AND la.status <> 'signed'
        ORDER BY la.created_at DESC
        LIMIT 1;
      $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS auth_pending_signing_link(uuid);`);
  }
}
