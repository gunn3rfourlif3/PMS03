import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-admin "sign in as agency" (support impersonation).
 *  - impersonation_events: audit trail (platform-scoped; no RLS).
 *  - platform_agencies():  SECURITY DEFINER list of all vendors for the admin
 *                          agencies picker (vendors has FORCE RLS).
 *  - impersonation_target(): SECURITY DEFINER name + status for one vendor, used
 *                          to validate + label an impersonation session.
 */
export class Impersonation1720000036000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS impersonation_events (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id uuid NOT NULL,
        admin_email   text,
        vendor_id     uuid NOT NULL,
        vendor_name   text,
        reason        text,
        ip            text,
        started_at    timestamptz NOT NULL DEFAULT now(),
        ended_at      timestamptz
      );`);
    await q.query(`CREATE INDEX IF NOT EXISTS impersonation_events_started_idx ON impersonation_events (started_at DESC);`);

    await q.query(`
      CREATE OR REPLACE FUNCTION platform_agencies()
      RETURNS TABLE(vendor_id uuid, name text, slug text, status text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT id, name, slug, status FROM vendors ORDER BY name;
      $$;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION impersonation_target(p_vendor uuid)
      RETURNS TABLE(name text, status text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$
        SELECT name, status FROM vendors WHERE id = p_vendor;
      $$;`);

    // Grant the app role access to the audit table (no-op where pms_app is absent,
    // e.g. local dev; production sets it up via default privileges too).
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
        GRANT SELECT, INSERT, UPDATE ON impersonation_events TO pms_app;
      END IF;
    END $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS impersonation_target(uuid);`);
    await q.query(`DROP FUNCTION IF EXISTS platform_agencies();`);
    await q.query(`DROP TABLE IF EXISTS impersonation_events;`);
  }
}
