import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Municipal utility capture — see docs/LOCARE_UTILITIES_BUILD_PLAN.md.
 *
 * Two tenant-scoped tables, so their RLS policies ship here, in the same
 * migration, per CLAUDE.md.
 *
 * `utility_meters` is a metering OR charge point. It hangs off a unit (a
 * submeter, recovered from that tenant) or off a property (the bulk municipal
 * meter), never both — the CHECK below enforces it, because the recovery gap
 * (bulk minus the sum of its submeters) is only computable if the two are
 * distinguishable.
 *
 * `metered = false` covers sewerage and refuse, which are not read but appear on
 * the same municipal account. Their readings carry a cost and nothing else.
 *
 * Record only: nothing here posts to the ledger or raises an invoice line.
 */
export class UtilityMeters1720000055000 implements MigrationInterface {
  name = 'UtilityMeters1720000055000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "utility_meters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "property_id" uuid,
        "unit_id" uuid,
        "kind" text NOT NULL,
        "metered" boolean NOT NULL DEFAULT true,
        "unit_of_measure" text NOT NULL DEFAULT 'kWh',
        "serial" text,
        "label" text,
        "multiplier" numeric NOT NULL DEFAULT 1,
        "dial_digits" int,
        "status" text NOT NULL DEFAULT 'active',
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_utility_meters_kind"
          CHECK ("kind" IN ('electricity','water','gas','sewerage','refuse')),
        CONSTRAINT "ck_utility_meters_uom"
          CHECK ("unit_of_measure" IN ('kWh','kL','m3','fixed')),
        CONSTRAINT "ck_utility_meters_status"
          CHECK ("status" IN ('active','removed')),
        CONSTRAINT "ck_utility_meters_multiplier" CHECK ("multiplier" > 0),
        -- A submeter OR a bulk meter, never both and never neither.
        CONSTRAINT "ck_utility_meters_attachment"
          CHECK (("unit_id" IS NULL) <> ("property_id" IS NULL))
      );`);

    await q.query(`CREATE INDEX "ix_utility_meters_property" ON "utility_meters" ("vendor_id", "property_id");`);
    await q.query(`CREATE INDEX "ix_utility_meters_unit" ON "utility_meters" ("vendor_id", "unit_id");`);
    await q.query(`CREATE INDEX "ix_utility_meters_kind" ON "utility_meters" ("vendor_id", "kind") WHERE "status" = 'active';`);
    // A meter number is how a clerk and a municipal bill refer to the same
    // meter, so two live meters must not share one. Partial: removed meters keep
    // their serial for history, and a replacement may legitimately reuse it.
    await q.query(`
      CREATE UNIQUE INDEX "ux_utility_meters_serial_live"
        ON "utility_meters" ("vendor_id", "serial")
        WHERE "serial" IS NOT NULL AND "status" = 'active' AND "deleted_at" IS NULL;`);

    await q.query(`
      CREATE TABLE "utility_readings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vendor_id" uuid NOT NULL,
        "meter_id" uuid NOT NULL REFERENCES "utility_meters" ("id"),
        "reading_date" date NOT NULL,
        "reading" numeric,
        "consumption" numeric,
        "rollover" boolean NOT NULL DEFAULT false,
        "estimated" boolean NOT NULL DEFAULT false,
        "tariff_rate" numeric,
        "cost" numeric,
        "source" text NOT NULL DEFAULT 'manual',
        "captured_by_user_id" uuid,
        "media" jsonb NOT NULL DEFAULT '[]',
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_utility_readings_source"
          CHECK ("source" IN ('manual','import','device')),
        CONSTRAINT "ck_utility_readings_nonneg"
          CHECK (("reading" IS NULL OR "reading" >= 0) AND ("cost" IS NULL OR "cost" >= 0))
      );`);

    // The capture screen and the gap report both read a meter's readings in date
    // order; this is the index both of them want.
    await q.query(`CREATE INDEX "ix_utility_readings_meter_date" ON "utility_readings" ("vendor_id", "meter_id", "reading_date" DESC);`);
    // One reading per meter per day. A second capture on the same day is a
    // correction, and a correction should replace rather than silently stack —
    // two readings a day apart with no gap produce a consumption of zero and an
    // agency that cannot see why.
    await q.query(`
      CREATE UNIQUE INDEX "ux_utility_readings_per_day"
        ON "utility_readings" ("meter_id", "reading_date")
        WHERE "deleted_at" IS NULL;`);

    for (const table of ['utility_meters', 'utility_readings']) {
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
    for (const table of ['utility_readings', 'utility_meters']) {
      await q.query(`DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`);
      await q.query(`DROP TABLE IF EXISTS "${table}";`);
    }
  }
}
