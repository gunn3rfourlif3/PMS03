# Locare — White-Label Platform Design

Status: **Draft for build.** Owner: Arthur / Vernon. Last updated: 2026-07-30.

Locare (`locare.co.za`) is the neutral, sellable brand of the property-management
platform that PMS0.3 already is. It is **not** a new codebase, VPS, or database —
it is a platform-identity + onboarding layer added to the existing multi-tenant
system. Dantalan becomes the first agency (a `vendor`) running on it, unchanged,
on its own custom domain.

---

## 1. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | What Locare is | **Platform brand.** Agencies are tenants (`vendors`); Dantalan = agency #1. |
| 2 | Isolation | **Shared VPS + one Postgres, RLS-isolated** per vendor. |
| 3 | Agency addressing | **Both** — `{agency}.locare.co.za` (wildcard) **and** bring-your-own custom domain. |
| 4 | Code strategy | **Single repo, config-driven.** No fork. Per-brand differences live in the DB (`vendors`) or env. |
| 5 | Agency back-office | Same subdomain: public rentals at `/`, staff + tenant behind `/login`. No per-agency `app.` subdomain. |
| 6 | Dantalan | **No change.** Stays a custom-domain vendor on `dantalan.co.za`. |

Escape hatch (future, not now): a fully isolated instance for a specific
operator is the *same repo* deployed again with its own `deploy/.env.prod` +
Caddyfile + DB — never a code copy.

---

## 2. Mental model

```
Locare (platform brand, locare.co.za)
├── Marketing + self-serve agency signup        (locare.co.za, www)
├── Platform admin (approve agencies, billing)   (PLATFORM_ADMIN_EMAILS)
└── Agencies = vendors (RLS-isolated)
    ├── Dantalan        → dantalan.co.za            (custom_domain)
    ├── Agency B        → agencyb.locare.co.za       (wildcard subdomain)
    └── Agency C        → rentals.agencyc.com        (custom_domain)
```

Three brand layers, in resolution order for any request hostname:

1. **Vendor brand** — hostname matches a `vendors.slug` (as `{slug}.locare.co.za`)
   or `vendors.custom_domain`. Serve that agency (this is 95% of traffic).
2. **Platform brand (Locare)** — hostname is `locare.co.za` / `www.locare.co.za`.
   Serve the Locare marketing + signup chrome.
3. **Generic default** — anything unmatched. Today this is the "Property Manager"
   `DEFAULT_BRANDING`; keep as a safety net only.

---

## 3. What already exists (reuse, don't rebuild)

- **RLS multi-tenancy** — `app.current_vendor_id` GUC, per-request transaction.
- **Domain-based branding** — `web-admin/lib/branding.ts` `brandKey()` derives the
  vendor from the hostname; `public_branding(text)` and `public_listings(text)`
  are SECURITY DEFINER and already resolve by **`slug OR custom_domain`**.
- **Per-vendor theme** — colours, logo, contact stored in `vendors.config.branding`;
  `applyTheme()` injects CSS variables at runtime.
- **Agency provisioning + signup** — `provision_agency` / `signup_agency` /
  `approve_agency` functions and the partner/agency signup controllers.
- **Monetisation** — subscription tiers (Starter/Growth/Enterprise) bill agencies;
  the partner-commission engine pays resellers; the rent/invoice engine is how
  agencies bill their own tenants.
- **Platform admin** — `PLATFORM_ADMIN_EMAILS` context + `/admin/*` pages.

---

## 4. What's new for Locare

### 4.1 Platform-brand config
Add platform-level identity, env-driven (git-ignored `deploy/.env.prod`):

```
PLATFORM_NAME=Locare
PLATFORM_DOMAIN=locare.co.za
PLATFORM_BRAND_COLOR=#111111        # Locare's own palette
PLATFORM_LOGO_URL=/brand/locare-logo.svg
PLATFORM_CONTACT_EMAIL=hello@locare.co.za
```

Branding resolution change: when `brandKey()` returns the platform domain (or a
reserved label like `www`), the branding endpoint returns the **Locare platform
brand** instead of the generic default. Implement as a `public_branding` branch,
or a dedicated `/api/branding/platform` the front-end falls back to.

### 4.2 `brandKey()` generalisation
Current logic special-cases known `*.dantalan.co.za` labels. Generalise:

- If host ends with `.locare.co.za`: the **first label is the agency slug**,
  unless it's in a reserved set → then it's the platform.
  `RESERVED = {www, api, app, admin, mail, cdn, static, assets}`.
- Else (a bring-your-own domain): pass the **full host** as the key; it matches
  `vendors.custom_domain`.
- `locare.co.za` / `www.locare.co.za` → platform brand.

### 4.3 Custom-domain verification (`ask` endpoint)
For Caddy on-demand TLS we need a public, unauthenticated, cheap check:

```
GET /api/branding/exists?domain=<host>   →  200 (known vendor domain) | 404
```

Backed by a SECURITY DEFINER `EXISTS` against `vendors` where
`custom_domain = host OR ('{label}' = slug AND host ends with .locare.co.za)` and
`status = 'active'`. This is the gate that stops Caddy issuing certs for arbitrary
domains pointed at the VPS.

---

## 5. Domains & TLS (Caddy)

Replace the hardcoded per-subdomain blocks with a platform-shaped config:

```caddy
{
    email admin@locare.co.za
    on_demand_tls {
        ask http://api:3000/api/branding/exists
    }
}

# Platform marketing + agency signup
locare.co.za, www.locare.co.za {
    encode zstd gzip
    reverse_proxy web:3001            # (or a dedicated marketing container)
}

# Every agency on a Locare subdomain — one wildcard block serves all of them.
*.locare.co.za {
    encode zstd gzip
    reverse_proxy web:3001
}

# API + mobile apps stay on fixed subdomains
api.locare.co.za      { reverse_proxy api:3000 }
tenant.locare.co.za   { reverse_proxy tenant:80 }
landlord.locare.co.za { reverse_proxy landlord:80 }

# Any agency custom domain (dantalan.co.za, …) — cert issued on demand,
# gated by the ask endpoint above.
:443 {
    tls { on_demand }
    reverse_proxy web:3001
}
```

Notes:
- `*.locare.co.za` needs a **wildcard TLS cert** (DNS-01 challenge, so a Caddy DNS
  provider plugin + API token) *or* on-demand TLS per subdomain. DNS-01 wildcard
  is cleaner for many subdomains; decide in Phase 2.
- The bare `:443 { tls { on_demand } }` catch-all handles custom domains; the
  `ask` gate is mandatory here.
- Agency back-office is **not** a separate host — the web app serves public
  rentals at `/` and authed staff/tenant UI behind `/login` on the same host.

### DNS
- `*.locare.co.za` A → VPS IP (wildcard).
- `locare.co.za`, `www` A → VPS IP.
- `api` / `tenant` / `landlord` `.locare.co.za` A → VPS IP.
- Each custom domain: agency creates an A record → VPS IP (onboarding step).

### CORS
`CORS_ORIGINS` must allow `https://locare.co.za`, `https://www.locare.co.za`, and
— because subdomains and custom domains are open-ended — the API should accept a
**regex/suffix match** for `*.locare.co.za` plus any active `custom_domain`.
Simplest robust approach: replace the static allowlist with an origin callback
that returns true when the origin is the platform domain, a `*.locare.co.za`
subdomain, or a known active `vendors.custom_domain`.

---

## 6. Agency onboarding flow

**Self-serve (locare.co.za/signup):**
1. Prospect submits agency name, desired slug, contact, plan.
2. `signup_agency` creates a `pending` vendor + owner membership.
3. Platform admin approves (`approve_agency`) → vendor `active`.
4. Agency is instantly live at `{slug}.locare.co.za`; branding editable in their
   back-office; custom domain optional later.

**Admin-created:** platform admin provisions directly via `/admin` (`provision_agency`).

**Custom domain add (self-serve later):** agency enters their domain → we store it
as `custom_domain` (unverified), show them the A-record to create → once DNS
resolves to the VPS, Caddy's `ask` gate returns 200 and a cert is issued
automatically. Optionally add a TXT-record verification step before activation.

---

## 7. Security

- **Tenant isolation** unchanged: RLS + `pms_app` (NOBYPASSRLS); cross-vendor reads
  only via audited SECURITY DEFINER functions.
- **Cert-abuse prevention:** on-demand TLS strictly gated by `/branding/exists`.
- **Reserved subdomains:** block `www/api/app/admin/...` from being claimed as an
  agency slug (enforce in `signup_agency` + `brandKey`).
- **Platform admin:** `PLATFORM_ADMIN_EMAILS` only; must not overlap with an
  agency-owner email (existing rule — vernon@zaaka.io stays out of it if he owns
  an agency).
- **Secrets** stay in git-ignored `deploy/.env.prod`. Platform subscription
  billing uses the platform payment account; each agency keeps its own gateway
  config for tenant rent collection.
- Slug stays immutable once live (apps/domains resolve on it).

---

## 8. Phased roadmap

**Phase 0 — Platform brand layer**
- Env config (`PLATFORM_*`), Locare logo/palette assets.
- Branding resolver returns Locare brand for the platform domain.
- `brandKey()` generalised for `*.locare.co.za` + reserved labels.

**Phase 1 — Custom-domain gate + CORS**
- `GET /api/branding/exists?domain=` SECURITY DEFINER endpoint.
- CORS origin callback (platform domain + `*.locare.co.za` + active custom domains).

**Phase 2 — Caddy + DNS**
- Wildcard `*.locare.co.za` block; decide DNS-01 wildcard cert vs on-demand.
- Catch-all on-demand TLS for custom domains, gated by the ask endpoint.
- Wildcard + apex DNS records.

**Phase 3 — Locare marketing + self-serve signup**
- `locare.co.za` landing (sell the platform).
- `locare.co.za/signup` → `signup_agency` → admin approval.

**Phase 4 — Platform admin polish**
- Agencies list (approve/suspend), subscription/MRR overview, custom-domain
  management with A-record instructions + verification state.

**Phase 5 — Onboarding runbook + docs**
- Repeatable "add an agency" checklist; agency-facing custom-domain guide.

Dantalan requires **zero migration** at any phase — it already runs as a
custom-domain vendor.

---

## 9. Open questions

- **[DECIDED] Wildcard TLS: DNS-01 wildcard cert for `*.locare.co.za`.**
  DNS is at **HostAfrica, which has no Caddy/libdns plugin**, so DNS-01 can't run
  against it directly. **Resolution: move `locare.co.za` DNS to Cloudflare** (keep
  registration at HostAfrica; change nameservers to Cloudflare's free tier), then
  build Caddy with the `caddy-dns/cloudflare` plugin and put a scoped
  `CLOUDFLARE_API_TOKEN` in `deploy/.env.prod`.
  - Alternative (if DNS must stay at HostAfrica): `acme-dns` delegation — run an
    acme-dns service and CNAME `_acme-challenge.locare.co.za` to it, using the
    `caddy-dns/acmedns` plugin.
  - Agency **custom domains** still use on-demand TLS (gated by `/branding/exists`),
    independent of this.
  - Build implication: the prod Caddy image must be a custom `xcaddy` build that
    includes the chosen DNS plugin (the stock `caddy:2-alpine` image won't have it).
- **[DECIDED] Mobile apps: single shared apps by default; per-agency native as a
  paid add-on; PWA as the cheap middle option.**
  - **Default:** one shared Locare Tenant app + one Landlord app. They resolve the
    agency from the signed-in user and theme from the API branding. One build, one
    store listing, no per-agency work.
  - **Cheap middle (offer to all agencies):** the branded web app is a PWA
    ("Add to Home Screen") — an installable, icon-on-the-homescreen experience per
    agency with zero app-store submission. Covers most agencies' real want (their
    icon on tenants' phones).
  - **Premium / Enterprise add-on:** a fully branded native app per agency.
    Feasible because the Expo apps are already white-label — it's a packaging job
    (per-agency `app.config.js`: name, icon, splash, bundle id/package, deep-link
    scheme; EAS build profile) rather than new engineering. **Must be published
    under the agency's own Apple ($99/yr) + Google ($25) developer accounts** to
    pass Apple guideline 4.3 (template-app rejection). Priced to cover first-build
    setup + ongoing per-release re-submission overhead (every SDK/OS bump
    multiplies across each agency app).
- **[DECIDED] Apex is pure marketing + agency signup initially, architected to
  pivot to an aggregate marketplace later.**
  - Now: `locare.co.za` = platform marketing + `/signup`. Renters go to a specific
    agency, not the apex.
  - Keep the door open cheaply (no marketplace build yet, just don't paint over it):
    - Add a `vendors.list_on_marketplace boolean DEFAULT false` opt-in column now,
      so agencies can consent later without a migration scramble.
    - Keep public listing reads brand-scoped, but design them so a future
      `platform_listings()` SECURITY DEFINER function can aggregate across all
      `active` vendors where `list_on_marketplace = true` (mirror `public_listings`,
      just drop the single-vendor filter).
    - Preserve stable public listing URLs (`/l/<id>`) and photo/media handling so a
      future marketplace can deep-link straight into the owning agency's apply flow.
  - Pivot, when wanted: build the aggregate browse/search at the apex over
    `platform_listings()`, add dedup/ranking, and flip the opt-in for willing
    agencies. No re-architecture required.
