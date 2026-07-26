import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Generated lease agreements + native e-signature. public_lease_agreement(ref)
 * is a SECURITY DEFINER lookup for the unauthenticated signing page (resolves
 * the request by its unguessable ref, bypassing RLS but only exposing what the
 * signer needs).
 */
export class LeaseAgreement1720000022000 implements MigrationInterface {
  name = 'LeaseAgreement1720000022000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "lease_agreements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "lease_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "ref" varchar NOT NULL,
        "file_url" varchar NOT NULL,
        "render_data" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'sent',
        "signer_name" varchar,
        "signer_ip" varchar,
        "signed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_lease_agreement_ref" ON "lease_agreements" ("ref");`);
    await q.query(`CREATE INDEX "ix_lease_agreement_status" ON "lease_agreements" ("vendor_id", "status");`);
    await q.query(`CREATE INDEX "ix_lease_agreement_lease" ON "lease_agreements" ("lease_id");`);

    await q.query(`ALTER TABLE "lease_agreements" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "lease_agreements" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "lease_agreements_tenant_isolation" ON "lease_agreements"
      USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
      WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION public_lease_agreement(p_ref text)
      RETURNS json
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT json_build_object(
          'vendorId', vendor_id, 'status', status, 'fileUrl', file_url,
          'signerName', signer_name, 'signedAt', signed_at
        )
        FROM lease_agreements WHERE ref = p_ref AND deleted_at IS NULL LIMIT 1;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS public_lease_agreement(text);`);
    await q.query(`DROP POLICY IF EXISTS "lease_agreements_tenant_isolation" ON "lease_agreements";`);
    await q.query(`DROP TABLE IF EXISTS "lease_agreements";`);
  }
}
