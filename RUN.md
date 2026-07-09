# Running PMS 0.3 locally

Complete runbook for the whole system on Windows (PowerShell): the NestJS API + Postgres/Redis, the Next.js web back-office, and the two Expo mobile apps (tenant & landlord).

Do the **backend first** — everything else talks to it — then start whichever frontend you want.

---

## What's inside

Four surfaces over one NestJS API (multi-vendor, per-vendor white-label branding):

| Surface | Who | Highlights |
| --- | --- | --- |
| Web back-office | Agency staff | Dashboard, properties/units, leases & renewals, listings & applications, owners, service providers, reports/exports, documents & e-sign, inspections, API keys, notifications, **messaging**, settings/branding |
| Owner portal (web) | Property owners | `/portal` — statements, payouts, properties, banking (role-scoped view of the same console) |
| Tenant app (Expo) | Tenants | Home, pay rent, documents, maintenance, **messaging**, profile |
| Landlord app (Expo) | Agency staff on the go | Dashboard, approvals, maintenance (assign to service providers), **messaging**, profile |

Cross-cutting: passwordless OTP auth, Postgres row-level security per vendor,
double-entry ledger, VAT invoicing, owner statements + provider-gated split
payouts, and in-app messaging between tenants and staff.

Owner **banking details are encrypted at rest** (AES-256-GCM) — set a stable
`PII_ENCRYPTION_KEY` in `.env` for production; blank uses an insecure dev key.
Staff see masked account numbers in the owners list; full numbers are only
returned on an explicit, manager-gated request.

---

## 1. Backend + database (the API)

```powershell
cd C:\xampp\htdocs\development\PMS0.3

npm install                     # first time only
docker compose up -d            # Postgres on :5433, Redis on :6380
Copy-Item .env.example .env     # first time only (skip if you already have .env)
```

**One-time database setup** — creates the least-privileged app role, the schema + RLS
policies, and demo data:

```powershell
# create the pms_app runtime role (once)
Get-Content scripts/setup-app-role.sql | docker compose exec -T postgres psql -U pms -d pms

npm run migration:run           # tables + RLS policies (re-run whenever there are new migrations)
npm run seed                    # full demo: vendors, owners, properties, leases,
                                # invoices, tickets/work-orders, statements, listings,
                                # applications, service providers, messages
```

**Start the API** (leave this window running):

```powershell
npm run start:dev               # http://localhost:3000/api
```

---

## 2. Web back-office (Next.js console)

```powershell
cd C:\xampp\htdocs\development\PMS0.3\web-admin
npm install                     # first time (pulls Tailwind + lucide-react)
npm run dev                     # http://localhost:3001
```

---

## 3. Mobile apps (Expo — tenant & landlord)

**Tenant app:**

```powershell
cd C:\xampp\htdocs\development\PMS0.3\mobile-tenant
npm install                     # first time
npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans   # first time
npm start                       # then press w for web, or scan the QR with Expo Go
```

**Landlord app** — identical, in its own folder:

```powershell
cd C:\xampp\htdocs\development\PMS0.3\mobile-landlord
npm install
npx expo install expo-blur expo-linear-gradient @expo-google-fonts/plus-jakarta-sans
npm start
```

---

## Logging in

Auth is **passwordless OTP**. In dev the 6-digit code is **printed to the API window**
(step 1) — it is not sent anywhere. Request a code in the app, read it from the API
console, and enter it.

| Surface | Login |
| --- | --- |
| Web console & landlord app | `owner@demo.test` |
| Tenant app | `thabo@demo.test` |
| Owner portal (web) | `sipho@owner.demo.test` |

The **owner portal** is a role-scoped area of the web console: signing in as a
property owner (role `owner`) lands on `/portal` — showing only their statements,
payouts, properties and banking. Staff logins see the full back-office as before.

**Messaging demo:** sign into the tenant app as `thabo@demo.test` (seeded threads
incl. the geyser leak) and reply from the web console or landlord app as
`owner@demo.test` — both sides see unread markers and read receipts.

---

## White-label brand switch

Two brands are seeded. Point an app at one via its slug:

- **Mobile:** set `VENDOR_SLUG` in `mobile-tenant/src/config.ts` / `mobile-landlord/src/config.ts` (`demo` or `rivonia`), then reload.
- **Web:** start it with `NEXT_PUBLIC_VENDOR_SLUG=rivonia npm run dev`.

`demo` is the vendor with all the seeded data. `rivonia` (`owner@rivonia.test`) exists to
demo the brand swap (navy + Poppins) and has no leases/tickets.

---

## Ports

| Service | Port |
| --- | --- |
| API | 3000 |
| Web back-office | 3001 |
| Postgres | 5433 |
| Redis | 6380 |
| Expo dev server | 8081 |

---

## Day-to-day (after first-time setup)

Just three kinds of window:

```powershell
# API
cd C:\xampp\htdocs\development\PMS0.3;            npm run start:dev
# Web
cd C:\xampp\htdocs\development\PMS0.3\web-admin;  npm run dev
# Mobile (each app)
cd C:\xampp\htdocs\development\PMS0.3\mobile-tenant;   npm start
```

**Or start everything at once** with the launcher — it frees the ports, brings up
Docker, and opens each app in its own window:

```powershell
cd C:\xampp\htdocs\development\PMS0.3
.\scripts\start-all.ps1            # start the whole stack
.\scripts\start-all.ps1 -Setup     # first run / after new migrations (install + migrate + seed)
.\scripts\start-all.ps1 -NoMobile  # API + web only
```

> If PowerShell blocks the script ("running scripts is disabled"), allow it for
> your user once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

- Re-run `npm run migration:run` (then `npm run seed` + restart the API) after pulling
  new migrations — e.g. the messaging and owner-portal tables were added recently.
- Re-run `npm install` / `npx expo install` **only** when packages were added.
- Make sure Docker is running (`docker compose up -d`) before starting the API.

---

## API smoke tests (optional)

PowerShell scripts that exercise the same endpoints the apps call live in
`scripts/api-tests/` — see `scripts/api-tests/README.md`.

```powershell
cd C:\xampp\htdocs\development\PMS0.3\scripts\api-tests
./test-branding.ps1     # public branding (no login needed)
./test-tenant.ps1       # tenant journey
./test-landlord.ps1     # landlord journey
```

---

## Troubleshooting

- **`Module not found` / build error in web-admin** — run `npm install` in `web-admin` (Tailwind + lucide-react aren't installed yet).
- **Mobile won't bundle (missing `expo-blur` etc.)** — run the `npx expo install …` line for that app.
- **401 Unauthorized** in the API test scripts — the cached token expired; re-run the matching `login.ps1`.
- **`password authentication failed for user "pms"`** — the API's `.env` isn't pointing at port 5433, or Docker isn't up.
- **Icons show as boxes on web** — stale bundle; restart Expo with `npm start -- --clear`.
