import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * API keys for machine-to-machine integrators, RLS-scoped, plus a
 * SECURITY DEFINER lookup (by public prefix) so an incoming key with no vendor
 * context can be resolved to its vendor + hash for verification.
 */
export class ApiKeys1720000012000 implements MigrationInterface {
  name = 'ApiKeys1720000012000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "prefix" varchar NOT NULL,
        "key_hash" varchar NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "last_used_at" timestamptz,
        "revoked_at" timestamptz,
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_api_keys_prefix" ON "api_keys" ("prefix");`);

    await q.query(`ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "api_keys_tenant_isolation" ON "api_keys"
      USING ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid)
      WITH CHECK ("vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid);
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION api_key_lookup(p_prefix varchar)
      RETURNS TABLE(vendor_id uuid, key_hash varchar, scopes jsonb,
                    revoked_at timestamptz, expires_at timestamptz)
      LANGUAGE sql SECURITY DEFINER SET search_path = public
      AS $$
        SELECT vendor_id, key_hash, scopes, revoked_at, expires_at
        FROM api_keys WHERE prefix = p_prefix AND deleted_at IS NULL;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS api_key_lookup(varchar);`);
    await q.query(`DROP POLICY IF EXISTS "api_keys_tenant_isolation" ON "api_keys";`);
    await q.query(`DROP TABLE IF EXISTS "api_keys";`);
  }
}
