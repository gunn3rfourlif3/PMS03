# Locare — Platform-Admin "Sign in as Agency" (Support Impersonation)

Status: **Draft for build.** Owner: Arthur. Last updated: 2026-07-31.

Let a Locare **platform admin** open a specific agency's back office to
troubleshoot/support — data-scoped to that one agency, time-boxed, clearly
flagged in the UI, and fully audited — then exit back to the operator console.

---

## 1. Problem & goal

Today a platform admin (`vernon@zaaka.io`) at `app.locare.co.za` sees only the
operator console (Partners / Commissions / Billing). They cannot see an agency's
Dashboard / Properties / Listings / Payments to help debug an issue. Goal: a
safe, audited "drop into agency X" so support can see exactly what the agency
sees, without needing the agency's own login.

---

## 2. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Who can impersonate | **Platform admins only** (`PLATFORM_ADMIN_EMAILS`). |
| 2 | Access level | **Full read/write, MVP** — but audited + banner. Read-only mode is a later enhancement (§8). |
| 3 | Scope | Exactly **one agency (vendor)** per session; RLS-scoped like any vendor user. |
| 4 | Session | **Time-boxed** (`IMPERSONATION_TTL_MINUTES`, default 45), **revocable** (Redis jti), single active impersonation at a time. |
| 5 | Branding during impersonation | Keep **Locare** theme (host-based) + a banner naming the agency. (Simpler than swapping brand mid-session; revisit if support wants the agency's exact view.) |
| 6 | Reason note | **Optional but prompted** on start (captured in the audit log). |
| 7 | Audit | Every start/stop written to an `impersonation_events` table, viewable in the admin console. |

---

## 3. How it works (auth model)

The JWT carries `{ sub, vendorId, roles, partnerId?, jti }`. Impersonation issues
a **new token** for the admin's user that:

- sets `vendorId = <agency>` (so `RlsInterceptor` scopes all queries to that
  agency automatically — no per-endpoint changes),
- grants an agency role for that vendor (MVP: `property_manager`; see §8 for a
  dedicated read-only `platform_support` role later),
- adds an **`act` claim**: `{ impersonatorId, impersonatorEmail }` so the system
  knows this is impersonation (drives the banner, audit, and future restrictions),
- gets a fresh `jti` registered in the revocable session store with the
  impersonation TTL.

Exiting re-issues the admin's normal platform-admin token (`vendorId=null`,
`roles=[platform_admin]`) and revokes the impersonation `jti`.

Rules: platform admins cannot be impersonated; impersonation cannot nest; the
`act` claim can never be self-granted by a non-admin (only the impersonate
endpoint, guarded by `platform_admin`, mints it).

---

## 4. Backend

**Endpoints** (all under the platform-admin guard except stop, which just needs a
valid impersonation token):

- `POST /admin/impersonate` `{ vendorId, reason? }` → platform_admin only.
  Validates the vendor is `active`, mints the impersonation token, registers the
  session, writes an `impersonation_events` row (start). Returns `{ accessToken, idleMinutes, agency:{id,name} }`.
- `POST /admin/impersonate/stop` → with the impersonation token: revokes the jti,
  stamps `ended_at` on the audit row, returns a fresh platform-admin token.
- `GET /admin/impersonation-events` → platform_admin: paged audit list.

**Audit table** (migration; platform-scoped, no RLS / admin-only via SECURITY
DEFINER read):

```
impersonation_events(
  id uuid pk, admin_user_id uuid, admin_email text,
  vendor_id uuid, vendor_name text,
  reason text null, ip text null,
  started_at timestamptz, ended_at timestamptz null )
```

**Auth changes:** extend `JwtPayload` with optional `act`; `AuthService` gains
`impersonate(adminPrincipal, vendorId, reason, ip)` and `stopImpersonation(principal)`.
Role/RLS plumbing is unchanged — the token's `vendorId` + role do the scoping.

**Guardrails:** short TTL; revocable; single active session per admin; log
start/stop; banking stays encrypted/masked as today.

---

## 5. Web (back-office)

- **Agencies list** (new `/admin/agencies`, or extend `/admin/partners`): each
  active agency row gets an **"Open back office →"** action. Optional reason
  prompt → `POST /admin/impersonate` → store the returned token (replacing the
  session token in memory/storage) → redirect to `/` (agency dashboard). The app
  now renders the full agency nav + that vendor's data.
- **Impersonation banner:** a persistent top bar shown whenever the session token
  has an `act` claim — e.g. *"Viewing {Agency} as Locare support · Exit"*. Exit →
  `POST /admin/impersonate/stop` → swap back to the admin token → redirect to
  `/admin`. Banner uses a distinct colour so it's never mistaken for normal use.
- `api.ts`: `impersonate(vendorId, reason?)`, `stopImpersonation()`; expose the
  `act` claim to the shell (via `/me` or decoding the token) to toggle the banner
  and the "Exit" control.

---

## 6. Security & privacy

- Only `platform_admin` can start; enforced server-side, not just UI.
- Full audit trail (who, which agency, when, how long, reason, IP).
- Time-boxed + instantly revocable via the existing session store.
- No nested impersonation; admins can't impersonate other admins.
- PII/banking remain encrypted-at-rest and masked exactly as for a normal vendor
  user — impersonation grants the *role's* view, nothing more.
- Consider a per-agency opt-out / notify-agency-on-support-access later (trust).

---

## 7. Phased roadmap

1. **Backend core** — `impersonate` / `stop` endpoints, `act` claim, session +
   TTL, vendor-active validation.
2. **Audit** — `impersonation_events` migration + start/stop logging + admin read
   endpoint.
3. **Web: enter** — Agencies list action + token swap + redirect.
4. **Web: banner/exit** — persistent impersonation banner + exit flow.
5. **Web: audit view** — admin console page listing impersonation events.
6. **Verify** — tests (guards, TTL, revocation, audit), typecheck, deploy.

---

## 8. Later enhancements (out of scope for MVP)

- **Read-only mode:** a dedicated `platform_support` role that permits GET-style
  access only (block writes) for lower-risk support.
- **Agency notification / consent:** email the agency owner when support opens
  their back office; per-agency opt-out.
- **Reason required** + richer audit (pages visited).
- **Agency-brand view:** optionally load the agency's theme during impersonation
  so support sees the exact tenant experience.
