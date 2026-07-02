import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documents (metadata + versioning) and e-signature requests, RLS-scoped.
 * documents: operational (soft-delete). signature_requests: append-only with
 * mutable status.
 */
export class Documents1720000005000 implements MigrationInterface {
  name = 'Documents1720000005000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "owner_type" text NOT NULL,
        "owner_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "storage_key" varchar NOT NULL,
        "filename" varchar NOT NULL,
        "content_type" varchar NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "expiry_date" date,
        "access_scope" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'pending',
        "uploaded_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_documents_owner" ON "documents" ("vendor_id","owner_type","owner_id");`);

    await q.query(`
      CREATE TABLE "signature_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "provider" varchar NOT NULL,
        "provider_ref" varchar NOT NULL,
        "signer_email" varchar NOT NULL,
        "sign_url" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'sent',
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_sig_provider_ref" ON "signature_requests" ("provider_ref");`);
    await q.query(`CREATE INDEX "ix_sig_status" ON "signature_requests" ("status");`);

    for (const table of ['documents', 'signature_requests']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
        WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['documents', 'signature_requests']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "signature_requests";`);
    await q.query(`DROP TABLE IF EXISTS "documents";`);
  }
}
