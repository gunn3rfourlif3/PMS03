import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public webhooks (payment confirmation, e-sign callback) carry no auth/vendor
 * context, but write to vendor-scoped tables. These SECURITY DEFINER functions
 * resolve the owning vendor from the provider reference so the handler can run
 * inside that vendor's context (RLS-safe, vendor_id populated).
 */
export class WebhookVendorLookups1720000009000 implements MigrationInterface {
  name = 'WebhookVendorLookups1720000009000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION payment_vendor_by_ref(p_ref varchar)
      RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public
      AS $$ SELECT vendor_id FROM payments WHERE gateway_ref = p_ref; $$;
    `);
    await q.query(`
      CREATE OR REPLACE FUNCTION signature_vendor_by_ref(p_ref varchar)
      RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public
      AS $$ SELECT vendor_id FROM signature_requests WHERE provider_ref = p_ref; $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS payment_vendor_by_ref(varchar);`);
    await q.query(`DROP FUNCTION IF EXISTS signature_vendor_by_ref(varchar);`);
  }
}
