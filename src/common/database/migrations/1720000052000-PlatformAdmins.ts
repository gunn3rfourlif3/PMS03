import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-admin as data rather than an environment variable (gap R-2).
 *
 * Until now the only source of admin rights was `PLATFORM_ADMIN_EMAILS`, so
 * granting access meant editing `.env.prod` and recreating the API container —
 * and so did taking it away. That made delegation impossible and, worse, made
 * revocation a deploy: an operator who left kept their access until someone
 * SSH'd into the box.
 *
 * Grants are append-only. A revoke stamps `revoked_at` rather than deleting the
 * row, because "who could do this, and when" is a question you only ever ask
 * after something has gone wrong, and by then a deleted row is no answer.
 *
 * The env var survives as a BOOTSTRAP: it is how the first admin exists on a
 * fresh database, and how you get back in if the last grant is ever revoked by
 * accident. It is checked in addition to this table, never instead of it.
 */
export class PlatformAdmins1720000052000 implements MigrationInterface {
  name = 'PlatformAdmins1720000052000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS platform_admins (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email        text NOT NULL,
        note         text,
        granted_by   text,
        granted_at   timestamptz NOT NULL DEFAULT now(),
        revoked_by   text,
        revoked_at   timestamptz
      );`);

    // One ACTIVE grant per user; any number of historical ones.
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_active_user
        ON platform_admins (user_id) WHERE revoked_at IS NULL;`);
    await q.query(`
      CREATE INDEX IF NOT EXISTS platform_admins_email ON platform_admins (lower(email));`);

    // ── Is this address an admin right now? ────────────────────────────────
    // Called on every sign-in, so it is a single indexed lookup.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_admin_is(p_email text)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM platform_admins
           WHERE lower(email) = lower(btrim(coalesce(p_email, '')))
             AND revoked_at IS NULL
             AND btrim(coalesce(p_email, '')) <> ''
        );
      $$;`);

    // ── The list, for the UI. Active first, then most recently revoked. ────
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_admins_list()
      RETURNS TABLE (
        "id" uuid, "userId" uuid, "email" text, "name" text, "note" text,
        "grantedBy" text, "grantedAt" timestamptz,
        "revokedBy" text, "revokedAt" timestamptz
      ) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT a.id, a.user_id, a.email, u.name, a.note,
               a.granted_by, a.granted_at, a.revoked_by, a.revoked_at
          FROM platform_admins a
          LEFT JOIN users u ON u.id = a.user_id
         ORDER BY (a.revoked_at IS NULL) DESC, a.revoked_at DESC NULLS FIRST, a.granted_at DESC;
      $$;`);

    // ── Grant ──────────────────────────────────────────────────────────────
    // Creates the user row when the address has never signed in: you grant
    // access to a person, not to an existing account, and they may well be
    // hired before they first log in.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_admin_grant(
        p_email text, p_name text, p_by text, p_note text
      ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_email text; v_user uuid; v_id uuid;
      BEGIN
        v_email := lower(btrim(coalesce(p_email, '')));
        IF v_email = '' THEN RAISE EXCEPTION 'EMAIL_REQUIRED'; END IF;

        SELECT id INTO v_user FROM users WHERE lower(email) = v_email;
        IF v_user IS NULL THEN
          INSERT INTO users (name, email, status)
          VALUES (NULLIF(btrim(coalesce(p_name, '')), ''), v_email, 'active')
          RETURNING id INTO v_user;
        END IF;

        IF EXISTS (SELECT 1 FROM platform_admins WHERE user_id = v_user AND revoked_at IS NULL) THEN
          RAISE EXCEPTION 'ALREADY_ADMIN:%', v_email;
        END IF;

        INSERT INTO platform_admins (user_id, email, note, granted_by)
        VALUES (v_user, v_email, NULLIF(btrim(coalesce(p_note, '')), ''), lower(btrim(coalesce(p_by, ''))))
        RETURNING id INTO v_id;

        RETURN v_id;
      END; $$;`);

    // ── Revoke ─────────────────────────────────────────────────────────────
    // Both guards live here rather than in the service, so two admins revoking
    // each other at the same instant cannot leave the platform with none.
    await q.query(`
      CREATE OR REPLACE FUNCTION platform_admin_revoke(p_id uuid, p_by text)
      RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE v_email text; v_user uuid; v_by text; v_active int;
      BEGIN
        v_by := lower(btrim(coalesce(p_by, '')));

        SELECT email, user_id INTO v_email, v_user
          FROM platform_admins WHERE id = p_id AND revoked_at IS NULL
          FOR UPDATE;
        IF v_email IS NULL THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

        -- Removing your own access locks you out of the screen you would use to
        -- undo it. Ask another admin, or edit the bootstrap env var.
        IF lower(v_email) = v_by THEN RAISE EXCEPTION 'SELF_REVOKE'; END IF;

        SELECT count(*) INTO v_active FROM platform_admins WHERE revoked_at IS NULL;
        IF v_active <= 1 THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;

        UPDATE platform_admins
           SET revoked_at = now(), revoked_by = v_by
         WHERE id = p_id;

        RETURN v_user;
      END; $$;`);

    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pms_app') THEN
          GRANT SELECT, INSERT, UPDATE ON platform_admins TO pms_app;
        END IF;
      END $$;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP FUNCTION IF EXISTS platform_admin_revoke(uuid, text);`);
    await q.query(`DROP FUNCTION IF EXISTS platform_admin_grant(text, text, text, text);`);
    await q.query(`DROP FUNCTION IF EXISTS platform_admins_list();`);
    await q.query(`DROP FUNCTION IF EXISTS platform_admin_is(text);`);
    await q.query(`DROP TABLE IF EXISTS platform_admins;`);
  }
}
