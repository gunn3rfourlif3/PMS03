import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allowlist lookup for Caddy's on-demand TLS (docs/LOCARE_ONDEMAND_TLS_DESIGN.md).
 *
 * A TLS handshake for an unknown host arrives with no session and therefore no
 * `app.current_vendor_id`, so RLS hides every vendor from it — the same problem
 * the payment and DebiCheck webhooks have, and the same solution: a SECURITY
 * DEFINER function that answers one narrow question.
 *
 * Deliberately returns a BOOLEAN and nothing else. It cannot be used to
 * enumerate vendors, read a name, or confirm anything beyond "this deployment
 * serves that domain" — which the DNS records already say publicly.
 *
 * Only `status = 'active'` counts. A suspended agency stops getting renewals,
 * which is the intended behaviour and the assertion most likely to regress.
 */
export class TlsHostAllowlist1720000044000 implements MigrationInterface {
  name = 'TlsHostAllowlist1720000044000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION tls_host_allowed(p_base text, p_slug text)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM vendors
          WHERE status = 'active'
            AND (
              (NULLIF(p_base,'') IS NOT NULL AND lower(custom_domain) = lower(p_base))
              OR (NULLIF(p_slug,'') IS NOT NULL AND lower(slug) = lower(p_slug))
            )
        );
      $$;`);

    // The lookup runs on every first handshake for an unseen host, so neither
    // column should be a sequential scan.
    await q.query(`CREATE INDEX IF NOT EXISTS idx_vendors_custom_domain_lower ON vendors (lower(custom_domain));`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_vendors_slug_lower ON vendors (lower(slug));`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS tls_host_allowed(text, text);`);
    await q.query(`DROP INDEX IF EXISTS idx_vendors_custom_domain_lower;`);
    await q.query(`DROP INDEX IF EXISTS idx_vendors_slug_lower;`);
  }
}
