import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema + Row-Level Security.
 *
 * Isolation model:
 *   - Every tenant-scoped table has vendor_id and RLS ENABLED + FORCED.
 *   - Policies compare vendor_id to the per-transaction GUC
 *     current_setting('app.current_vendor_id') that RlsInterceptor sets.
 *   - The `vendors` table itself is scoped by id = the current vendor.
 *   - Pre-auth tables (users, otp_challenges) are NOT vendor-scoped.
 *
 * Financial tables (deposits, ledger_entries) carry NO deleted_at — append-only.
 */
export class Init1720000000000 implements MigrationInterface {
  name = 'Init1720000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // ---- Identity ----
    await q.query(`
      CREATE TABLE "vendors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "type" text NOT NULL DEFAULT 'individual_landlord',
        "status" varchar NOT NULL DEFAULT 'active',
        "config" jsonb NOT NULL DEFAULT '{}',
        "default_currency" varchar NOT NULL DEFAULT 'ZAR',
        "custom_domain" varchar,
        "has_valid_ffc" boolean NOT NULL DEFAULT false,
        "has_trust_account" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );`);

    await q.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar,
        "email" varchar,
        "phone" varchar,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email");`);
    await q.query(`CREATE INDEX "ix_users_phone" ON "users" ("phone");`);

    await q.query(`
      CREATE TABLE "otp_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "destination" varchar NOT NULL,
        "code_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "attempts" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE INDEX "ix_otp_destination" ON "otp_challenges" ("destination");`);

    await q.query(`
      CREATE TABLE "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" text NOT NULL,
        "scope" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE UNIQUE INDEX "uq_membership_vendor_user" ON "memberships" ("vendor_id","user_id");`);

    // ---- Real estate ----
    await q.query(`
      CREATE TABLE "properties" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "address" jsonb,
        "type" text NOT NULL DEFAULT 'building',
        "owner_id" uuid,
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);

    await q.query(`
      CREATE TABLE "units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "label" varchar NOT NULL,
        "status" text NOT NULL DEFAULT 'vacant',
        "market_rent" numeric NOT NULL DEFAULT 0,
        "bedrooms" int NOT NULL DEFAULT 0,
        "bathrooms" int NOT NULL DEFAULT 0,
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_units_status" ON "units" ("status");`);
    await q.query(`CREATE INDEX "ix_units_market_rent" ON "units" ("market_rent");`);

    // ---- Leasing ----
    await q.query(`
      CREATE TABLE "leases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "type" text NOT NULL DEFAULT 'fixed',
        "status" text NOT NULL DEFAULT 'draft',
        "start_date" date NOT NULL,
        "end_date" date,
        "rent_amount" numeric NOT NULL,
        "billing_cycle" varchar NOT NULL DEFAULT 'monthly',
        "escalation" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );`);
    await q.query(`CREATE INDEX "ix_leases_status" ON "leases" ("status");`);

    // ---- Billing / Accounting (append-only: NO deleted_at) ----
    await q.query(`
      CREATE TABLE "deposits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "lease_id" uuid NOT NULL,
        "amount" numeric NOT NULL,
        "held_in" varchar NOT NULL,
        "interest_accrued" numeric NOT NULL DEFAULT 0,
        "proof_sent_at" timestamptz,
        "status" text NOT NULL DEFAULT 'held',
        "deductions" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);

    await q.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "transaction_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "debit" numeric NOT NULL DEFAULT 0,
        "credit" numeric NOT NULL DEFAULT 0,
        "entity_ref" varchar,
        "posted_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE INDEX "ix_ledger_txn" ON "ledger_entries" ("transaction_id");`);

    // ---------- Row-Level Security ----------
    // vendors: a session may only see its own vendor row.
    await this.enableRls(q, 'vendors', `"id" = current_setting('app.current_vendor_id', true)::uuid`);

    // tenant-scoped tables: vendor_id must match the GUC.
    for (const table of ['memberships', 'properties', 'units', 'leases', 'deposits', 'ledger_entries']) {
      await this.enableRls(q, table, `"vendor_id" = current_setting('app.current_vendor_id', true)::uuid`);
    }

    // Append-only guard: block UPDATE/DELETE on financial tables at the DB level.
    for (const table of ['deposits', 'ledger_entries']) {
      await q.query(`
        CREATE RULE "${table}_no_update" AS ON UPDATE TO "${table}" DO INSTEAD NOTHING;
      `);
      await q.query(`
        CREATE RULE "${table}_no_delete" AS ON DELETE TO "${table}" DO INSTEAD NOTHING;
      `);
    }

    // ---------- Auth bootstrap (RLS-safe cross-tenant lookup) ----------
    // Login must find which vendor(s) a user belongs to BEFORE a vendor context
    // exists — an inherently cross-tenant read that RLS on `memberships` would
    // block. This SECURITY DEFINER function runs as its (privileged) owner so
    // the narrow, by-user_id lookup succeeds. In production, create/own it with
    // a role that bypasses RLS (e.g. a service role); the app's normal request
    // role stays RLS-restricted.
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
      $$;
    `);
  }

  /** Enable + FORCE RLS and attach a single USING/WITH CHECK policy. */
  private async enableRls(q: QueryRunner, table: string, predicate: string): Promise<void> {
    await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    await q.query(`
      CREATE POLICY "${table}_tenant_isolation" ON "${table}"
      USING (${predicate})
      WITH CHECK (${predicate});
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS auth_memberships_for_user(uuid);`);
    for (const table of ['deposits', 'ledger_entries']) {
      await q.query(`DROP RULE IF EXISTS "${table}_no_update" ON "${table}";`);
      await q.query(`DROP RULE IF EXISTS "${table}_no_delete" ON "${table}";`);
    }
    for (const table of ['ledger_entries', 'deposits', 'leases', 'units', 'properties', 'memberships', 'vendors']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
    }
    await q.query(`DROP TABLE IF EXISTS "ledger_entries";`);
    await q.query(`DROP TABLE IF EXISTS "deposits";`);
    await q.query(`DROP TABLE IF EXISTS "leases";`);
    await q.query(`DROP TABLE IF EXISTS "units";`);
    await q.query(`DROP TABLE IF EXISTS "properties";`);
    await q.query(`DROP TABLE IF EXISTS "memberships";`);
    await q.query(`DROP TABLE IF EXISTS "otp_challenges";`);
    await q.query(`DROP TABLE IF EXISTS "users";`);
    await q.query(`DROP TABLE IF EXISTS "vendors";`);
  }
}
