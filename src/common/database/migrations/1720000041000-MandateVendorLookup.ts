import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vendor lookup for DebiCheck consent webhooks.
 *
 * A webhook arrives with no session and therefore no `app.current_vendor_id`,
 * so RLS hides every mandate from it. Same problem the payment webhooks have,
 * and the same solution: a SECURITY DEFINER function that resolves just the
 * vendor id, after which the handler re-enters normal tenant context and RLS
 * applies as usual (mirrors `payment_vendor_by_ref`, 1720000009000).
 *
 * Deliberately narrow — it returns a uuid and nothing else, so it cannot be
 * used to read mandate data outside a tenant context.
 */
export class MandateVendorLookup1720000041000 implements MigrationInterface {
  name = 'MandateVendorLookup1720000041000';

  public async up(q: QueryRunner): Promise<void> {
    // Matched on OUR reference (the mandate id) — the one we control.
    await q.query(`
      CREATE OR REPLACE FUNCTION mandate_vendor_by_id(p_id uuid)
      RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT vendor_id FROM debit_mandates WHERE id = p_id; $$;`);

    // Fallback for a webhook that quotes only the provider's own reference.
    await q.query(`
      CREATE OR REPLACE FUNCTION mandate_vendor_by_provider_ref(p_ref text)
      RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT vendor_id FROM debit_mandates WHERE provider_mandate_ref = p_ref; $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS mandate_vendor_by_id(uuid);`);
    await q.query(`DROP FUNCTION IF EXISTS mandate_vendor_by_provider_ref(text);`);
  }
}
