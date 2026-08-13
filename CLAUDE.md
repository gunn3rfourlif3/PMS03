# Locare (PMS 0.3) — working notes for Claude

Read this first. It's the context a new session doesn't have.

---

## What this is

**Locare** — a white-label, multi-tenant property-management platform for South
African rental agencies. Each agency runs the whole rental lifecycle (leasing,
rent collection, trust accounting, owner payouts, maintenance) under **its own
brand and domain**; tenants and owners never see Locare.

Live in production on a single Contabo VPS. One agency onboarded (**Dantalan**);
no paying customers yet.

- `locare.co.za` — marketing site (static)
- `app.locare.co.za` — back-office (Next.js)
- `api.locare.co.za` — API (NestJS)
- `app.dantalan.co.za`, `rentals.dantalan.co.za` — the first agency's hosts

## Layout

```
src/                NestJS 11 API — 27 modules under src/modules
  providers/        swappable integrations: payment, notification, kyc,
                    esign, storage, document-ai, policy
  common/database/  TypeORM data source + migrations (RLS lives here)
web-admin/          Next.js 14 App Router back-office + public rentals + signing
mobile-tenant/      Expo tenant app
mobile-landlord/    Expo landlord app
marketing/          static site, /tools calculators, /guides — served by Caddy
deploy/             compose.prod.yml, Caddyfile, backup.sh
scripts/            seed.ts, start-all.ps1, video/ pipeline, api-tests/
docs/               design docs — read the relevant one before changing a feature
test/               Jest unit tests (~25 specs)
```

## Non-negotiables

**Tenant isolation is enforced by Postgres, not application code.** Every
tenant-scoped table has RLS keyed on `app.current_vendor_id`. Queries run inside
a transaction that sets it. Never bypass this by querying as the owner role, and
never add a tenant-scoped table without an RLS policy in the same migration.

**The ledger is double-entry and immutable.** Invoicing, payments, deposits,
owner statements and payouts all post through it. Corrections are new postings,
never edits. This is the product's actual differentiator — treat it as sacred.

**PII is encrypted at rest** with AES-256-GCM via the `encryptedJson` transformer
(`src/common/security/pii-crypto.ts`): owner banking, partner KYC/KYB documents,
ID numbers. ⚠️ **Rotating `PII_ENCRYPTION_KEY` makes existing data unreadable** —
it needs a decrypt-and-re-encrypt migration, not just a new value.

**Auth is passwordless.** OTP over email (WhatsApp when enabled) → JWT
`{sub, vendorId, roles, partnerId?, jti, act?}`. A Redis session store keyed on
`jti` gives instant revocation. Two bugs already caused by forgetting this:
`/auth/refresh` must preserve `partnerId` and `act` when re-minting (regression
test: `test/auth-refresh.spec.ts`), and OTP codes are stored **hashed** in
`otp_challenges` — the only plaintext copy is the `[OTP] …` console line.

**Branding resolves from the request Host header, server-side**
(`web-admin/lib/brand-shared.ts`). The root layout is `force-dynamic` because of
it. Don't make it static — that bakes one host's brand into every response, which
was a genuinely painful bug (a whole afternoon lost to what looked like caching).

## Local development

```powershell
.\scripts\start-all.ps1 -Setup     # Docker + migrate + seed + API/web/Expo
```

Postgres `:5433`, Redis `:6380`, API `:3000`, web `:3001`, Expo `:8081`/`:8082`.
Requires Docker Desktop running — the script now fails loudly if it isn't.

`npm run seed` creates **Demo Agency** with fictional `@demo.test` users and a
deliberately realistic mix of paid / overdue / partly-paid invoices. Logins:
`owner@demo.test` (back-office), `thabo@demo.test` (tenant),
`sipho@owner.demo.test` (owner portal). OTP prints to the API window.

```bash
npx tsc --noEmit -p tsconfig.build.json    # API typecheck (NOT plain tsc — that
                                           # picks up the Expo apps and fails)
cd web-admin && npx tsc --noEmit           # web typecheck
npx jest test/<spec>                       # tests
```

`sharp` is a native dep with platform-specific binaries; specs that pull in
MediaService mock it (see `test/partner-application.spec.ts`).

## Deploying

Arthur runs all git and docker commands himself — write them out, don't assume
they've been run.

```bash
cd ~/PMS03 && git pull
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod build api web
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod up -d --force-recreate api web
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod exec api npm run migration:run:prod
```

**Always pass `--env-file deploy/.env.prod`.** Omitting it makes Compose fall
back to the repo-root `.env`, and the two have drifted — that's how a stale
`PLATFORM_ADMIN_EMAILS` survived in a running container for weeks.

**Env vars are fixed at container creation.** Editing `.env.prod` does nothing
until `up -d --force-recreate`. A plain `restart` won't do it.

Caddy config is mounted, so a Caddyfile change needs no rebuild — but
`caddy reload` has silently failed on this box (admin API refused). Use
`docker restart $(docker ps -qf name=caddy)`.

## Gotchas already paid for

- `caddy reload` no-ops here. Restart the container instead.
- Next.js sets its own `Cache-Control`; a plain Caddy `header` directive loses to
  it. `reverse_proxy { header_down … }` wins.
- Platform-admin rights come **only** from `PLATFORM_ADMIN_EMAILS`, not the DB.
- Roles are baked into the JWT at login — a role change needs a fresh sign-in.
- The marketing site's Lighthouse score (97, Speed Index 4.7s) came from removing
  a web-font CDN. Don't reintroduce blocking fonts or an autoplay hero video.
- `text=` Playwright selectors survive restyling; CSS class chains don't.

## Conventions

- Comments explain **why**, not what. Assume the reader can read code.
- South African English. ZAR. `en-ZA` date formatting.
- Money as integers in cents where it touches the ledger.
- Phone numbers normalised to E.164 (`src/common/phone/e164.ts`).
- New tenant-scoped table → migration with RLS policy, in the same file.
- Design docs in `docs/` are written before big features. Read the matching one
  before changing partner KYC, WhatsApp onboarding, impersonation or the chatbot.

## Automation already running

Three scheduled tasks (`C:\Users\verno\Claude\Scheduled\`), each self-contained:

- `locare-monday-review` — Mon 08:00, ops check + open launch items
- `locare-partner-queue-sweep` — Mon/Thu 09:00, stalled partner applications
- `locare-weekly-guide` — Tue 07:00, drafts an SEO guide for review (never publishes)

In-app BullMQ jobs: recurring billing, dunning, POPIA retention purge (03:30
daily), partner-application reminders (hourly, sends once per applicant).

`npm run video` runs the whole marketing-video pipeline — stack up, Playwright
records the product, ffmpeg assembles three cuts. See `scripts/video/README.md`.

## Outstanding

- Legal pages need the registered entity name, company reg number and address —
  placeholders were removed as an interim measure. **POPIA requires an
  identifiable responsible party before taking a paying customer.**
- Meta WhatsApp Business account not set up, so WhatsApp is off and everything
  falls back to email. Templates must be created and approved first; the auth
  template's expiry warning must match `OTP_TTL_SECONDS` (300 = 5 min).
- No live payment has ever been taken. `IKHOKHA_VERIFY_CALLBACK` is in monitor
  mode; flip to enforce after the first verified callback.
- Subscription billing has never charged a real agency.
- Google OAuth brand verification still unapproved.
- No error tracking or uptime monitoring in production.
- `deploy/backup.sh` exists but needs confirming in cron, and a restore test.
- `ANTHROPIC_API_KEY` unset, so the LLM lease parser is untested.
- Mobile apps are Expo web exports, not published to the app stores.

## Working with Arthur

Concise and direct. He runs his own git and docker commands. He'll push back on
weak reasoning — and has been right to. Flag real risks (POPIA, PII, credential
handling, unverifiable marketing claims) rather than quietly complying.
