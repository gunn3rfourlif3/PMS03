import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DebiCheck foundation — see docs/LOCARE_DEBIT_ORDER_DESIGN.md.
 *
 * Three things, all prerequisites for collecting anything:
 *
 * 1. `debit_mandates` (§4) — the mandate as a first-class, tenant-scoped entity.
 * 2. Per-vendor DebiCheck registration state and credentials (§7.1). Each agency
 *    collects under its OWN user code into its OWN trust account; Locare never
 *    holds tenant money. Only `active` may submit collections — everything else
 *    falls back to proof-of-payment and the back office says why.
 * 3. `leases.escalation_pct` — required by the §11.8 ceiling rule. The lease
 *    previously stored escalation only as renewal *history*, so there was no
 *    forward rate to project from and the ceiling could not be computed as
 *    specified. Nullable: existing leases have no stated rate and fall back to
 *    the documented default, which the mandate records as assumed.
 *
 * Both new tables are tenant-scoped, so RLS policies ship here, in the same
 * migration, per CLAUDE.md.
 */
export class DebitMandates1720000040000 implements MigrationInterface {
  name = 'DebitMandates1720000040000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "debit_mandates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "lease_id" uuid NOT NULL,
        "tenant_id" uuid,
        "state" text NOT NULL DEFAULT 'drafted',
        "max_collection_amount" numeric NOT NULL DEFAULT 0,
        "basis_rent_amount" numeric NOT NULL DEFAULT 0,
        "basis_escalation_pct" numeric NOT NULL DEFAULT 0,
        "basis_escalation_assumed" boolean NOT NULL DEFAULT false,
        "collection_day" int NOT NULL DEFAULT 1,
        "day_adjustment_allowed" boolean NOT NULL DEFAULT true,
        "first_collection_date" date,
        "provider_mandate_ref" text,
        "provider" text NOT NULL DEFAULT 'stitch',
        "authenticated_at" timestamptz,
        "expires_at" timestamptz,
        "cancelled_at" timestamptz,
        "status_reason" text,
        "banking" jsonb NOT NULL DEFAULT '{}',
        "history" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_debit_mandates_collection_day" CHECK ("collection_day" BETWEEN 1 AND 31)
      );`);

    // A lease may accumulate cancelled/rejected mandates over its life, but only
    // one may be live at a time — two active mandates means two collections.
    await q.query(`
      CREATE UNIQUE INDEX "ux_debit_mandates_live_per_lease"
        ON "debit_mandates" ("lease_id")
        WHERE "state" IN ('drafted','requested','active','amending');`);
    await q.query(`CREATE INDEX "ix_debit_mandates_state" ON "debit_mandates" ("vendor_id", "state");`);
    await q.query(`CREATE INDEX "ix_debit_mandates_provider_ref" ON "debit_mandates" ("provider_mandate_ref");`);
    // Drives the T-3 pre-collection check (§5.5).
    await q.query(`CREATE INDEX "ix_debit_mandates_collection_day" ON "debit_mandates" ("vendor_id", "collection_day") WHERE "state" IN ('active','amending');`);

    await q.query(`
      CREATE TABLE "vendor_payment_credentials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "provider" text NOT NULL DEFAULT 'stitch',
        -- Encrypted at rest (encryptedJson): user code, bureau credentials.
        "credentials" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_vendor_payment_credentials" UNIQUE ("vendor_id", "provider")
      );`);

    for (const table of ['debit_mandates', 'vendor_payment_credentials']) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
        USING ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid)
        WITH CHECK ("vendor_id" = current_setting('app.current_vendor_id', true)::uuid);
      `);
    }

    // §7.1 registration state machine. Lives on the vendor, not a separate
    // table: there is exactly one per agency and it gates every collection.
    await q.query(`
      ALTER TABLE "vendors"
        ADD COLUMN IF NOT EXISTS "debicheck_status" text NOT NULL DEFAULT 'not_registered',
        ADD COLUMN IF NOT EXISTS "debicheck_user_code" text,
        -- What the TENANT sees on their bank statement. Must match the trading
        -- name on the lease or debits get disputed (§11.6). ~10 chars.
        ADD COLUMN IF NOT EXISTS "creditor_short_name" text,
        ADD COLUMN IF NOT EXISTS "creditor_legal_name" text;`);
    await q.query(`
      ALTER TABLE "vendors"
        ADD CONSTRAINT "ck_vendors_debicheck_status"
        CHECK ("debicheck_status" IN ('not_registered','applied','active','suspended'));`);

    // §11.8: the forward escalation rate the ceiling projects from.
    await q.query(`ALTER TABLE "leases" ADD COLUMN IF NOT EXISTS "escalation_pct" numeric;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "leases" DROP COLUMN IF EXISTS "escalation_pct";`);
    await q.query(`ALTER TABLE "vendors" DROP CONSTRAINT IF EXISTS "ck_vendors_debicheck_status";`);
    await q.query(`
      ALTER TABLE "vendors"
        DROP COLUMN IF EXISTS "debicheck_status",
        DROP COLUMN IF EXISTS "debicheck_user_code",
        DROP COLUMN IF EXISTS "creditor_short_name",
        DROP COLUMN IF EXISTS "creditor_legal_name";`);
    for (const table of ['debit_mandates', 'vendor_payment_credentials']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
      await q.query(`DROP TABLE IF EXISTS "${table}";`);
    }
  }
}
