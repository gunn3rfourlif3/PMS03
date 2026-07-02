# PMS 0.3 — Property Management Platform

Multi-vendor, white-label, mobile-first rental management (landlords, agencies, tenants).
Backend: **NestJS modular monolith** on **PostgreSQL (shared schema + RLS)** with **Redis/BullMQ** for async work. First launch market: **South Africa**.

Full product spec: [`docs/SPEC.md`](docs/SPEC.md) (includes Appendix A — South Africa launch blueprint).

## Architecture at a glance

A single deployable app with clean internal module boundaries that mirror the domains. Modules own their own tables and never reach into each other's tables directly, so any module can be extracted into a service later — but only when measured need demands it.

```
src/
  main.ts                     app bootstrap
  app.module.ts               wires modules + tenant middleware
  common/
    base.entity.ts            TenantEntity (soft-delete) vs ImmutableTenantEntity (append-only)
    tenancy/                  per-request vendor resolution -> RLS + app-layer scope
  modules/                    domain modules (each: module/service/controller[/entities])
    identity/ properties/ leasing/ billing/ accounting/
    maintenance/ documents/ comms/ notifications/ reporting/
  providers/
    payment/                  PaymentProvider interface + Stitch (Phase 1) / Paystack (Phase 2)
    policy/                   market policies: rules in code, selection in config
      za/                     ZA_VAT, ZA_RHA (deposits), ZA_PPRA (FFC/trust gating)
```

## Key design rules baked into the scaffold

- **Financial + audit tables are append-only.** `LedgerEntry`, `Deposit`, invoices, payments, payouts extend `ImmutableTenantEntity` (no soft delete). Corrections use reversing entries, never edits. Operational tables extend `TenantEntity` (soft delete OK).
- **Multi-tenancy = RLS + defence-in-depth.** Every tenant table carries `vendor_id`; `TenantMiddleware` resolves the vendor per request to drive Postgres RLS *and* an app-layer scope so a missing policy can't leak data.
- **JSONB only for variable data.** Anything filtered/sorted (status, rent, dates) is a typed, indexed column — not JSONB.
- **Regional rails are pluggable.** Payments/tax/deposit/compliance sit behind interfaces; South Africa is the first implementation. Swap providers per market without touching billing/accounting.

## Getting started

```bash
# 1. dependencies
npm install

# 2. local infra (Postgres + Redis)
docker compose up -d

# 3. env
cp .env.example .env

# 4. database schema + RLS policies
npm run migration:run

# 5. run
npm run start:dev        # http://localhost:3000/api/<module>/health

# 6. tests (ZA policy + OTP crypto unit tests)
npm test
```

### Auth flow (passwordless OTP)

```bash
# request a code (dev: printed to the server console)
curl -X POST localhost:3000/api/auth/otp/request -H 'content-type: application/json' \
  -d '{"destination":"+27820000000"}'

# verify -> returns { accessToken }
curl -X POST localhost:3000/api/auth/otp/verify -H 'content-type: application/json' \
  -d '{"destination":"+27820000000","code":"123456"}'

# call a protected, tenant-scoped route
curl localhost:3000/api/properties/units -H 'authorization: Bearer <accessToken>'
```

## Data & tenancy layer (this iteration)

- **TypeORM + Postgres** wired via `DatabaseModule`, sharing one options object with the migration `DataSource` (`src/common/database/data-source.ts`) so app and CLI never drift. `synchronize` is off — schema changes go through migrations.
- **RLS enforcement**: the initial migration `ENABLE`s + `FORCE`s Row-Level Security on every tenant table with a policy comparing `vendor_id` to `current_setting('app.current_vendor_id')`. `RlsInterceptor` wraps each request in a transaction and sets that GUC; the transaction's `EntityManager` is carried in `AsyncLocalStorage` so services (via `TenantContextService.getRepository`) always query under RLS. App-layer `vendorId` stamping on writes is the defence-in-depth second layer.
- **Append-only finance**: `deposits` and `ledger_entries` have no `deleted_at` and carry DB rules blocking `UPDATE`/`DELETE` — corrections must be reversing entries.
- **Auth**: passwordless OTP (`/auth/otp/request` + `/auth/otp/verify`) issuing JWTs with `{ sub, vendorId, roles }`; `JwtStrategy` populates the request principal, `JwtAuthGuard` + `RolesGuard`/`@Roles()` protect routes. The login membership lookup uses a `SECURITY DEFINER` function to solve the RLS auth-bootstrap (cross-tenant read before a vendor context exists). OTP codes are stored only as HMACs.

## Roadmap (see docs/SPEC.md for detail)

- **Phase 0** — foundations: tenancy, RLS, auth, white-label config, observability. *(this scaffold)*
- **Phase 1** — "collect rent": properties/units/leases, recurring invoices, ledger, Stitch EFT, tenant + landlord mobile.
- **Phase 2** — operations & agencies: maintenance, documents/e-sign, owner statements + split payouts (Paystack), dunning, messaging, inspections.
- **Phase 3** — growth: listings/funnel, reporting, full config/localization, trust-account formalisation.
- **Phase 4** — scale: extract high-load modules, public API/webhooks, AI triage, IoT.

## Billing & accounting engine (this iteration)

The core of Phase 1 — turning a lease into money, correctly.

- **Double-entry ledger** (`accounting/`): `LedgerService.post()` validates that debits equal credits (in integer cents, so `0.1 + 0.2` can't drift) before writing all lines atomically inside the request's tenant transaction. `reverse()` is the only way to undo a transaction — it posts the mirror image, never edits. Pure validation logic lives in `double-entry.ts` and is unit-tested.
- **Chart of accounts** (`AccountingService`): idempotent get-or-create of standard accounts (AR, Rental Income, VAT Output, and a **trust-flagged** Tenant Deposits account for ZA PPRA/RHA segregation).
- **Invoicing** (`billing/`): `InvoiceService.generateRentInvoice()` builds the invoice (rent + ZA VAT via the policy layer) and posts the balancing transaction — `Dr AR / Cr Rental Income / Cr VAT Output` — in one atomic step, stamping the ledger txn id onto the append-only invoice. Invoice math is pure and unit-tested.
- **Async recurring billing** (BullMQ): `BillingScheduler` installs a monthly repeatable job (`0 6 1 * *`); `BillingProcessor` pulls the cross-tenant worklist via the `billing_active_leases(period)` `SECURITY DEFINER` function, then generates each vendor's invoices **inside that vendor's tenant context** using `TenantRunner` — so batch jobs stay RLS-safe. Idempotent: a unique `(vendor, lease, period)` index and the worklist's "not yet invoiced" filter make re-runs safe.

Run the billing job manually for a period via `BillingScheduler.enqueueForPeriod('2026-07', '2026-07-07')`.

### Money-in loop (payments) + dunning

- **Collection** (`PaymentService.initiate`): creates a pending `Payment` and asks the active `PaymentProvider` (Stitch/EFT by default) to collect, returning a pay-by-bank redirect.
- **Confirmation** (`PaymentService.confirm`, from the provider webhook): posts `Dr Bank / Cr Accounts Receivable`, allocates the amount to the invoice, and advances invoice status (issued → partly_paid → paid). Idempotent by `gateway_ref`, so webhook retries are safe.
- **Dunning** (`DunningService`, daily BullMQ job at 07:00): pulls overdue invoices via the `overdue_invoices()` function, posts a one-time late fee (`Dr AR / Cr Late Fee Income`, rate `LATE_FEE_PCT`), and marks them overdue — guarded by `late_fee_applied` so fees never stack.
- **Immutability model (corrected this iteration):** the **general ledger is the only DB-immutable table**; business documents (invoices, deposits, payments) keep append-only *amounts* by convention but allow legitimate *status* transitions. The over-strict UPDATE blocks on invoices/deposits were dropped in the payments migration.
- **ZA trust rule carried through:** rent collected for an owner must reach a trust account with the platform fee settled separately — the code deliberately does **not** auto-split fees out of client money at the gateway; that belongs to the owner-payout flow.

```bash
# tenant initiates payment for an invoice
curl -X POST localhost:3000/api/payments/invoices/<invoiceId>/initiate \
  -H 'authorization: Bearer <token>' -H 'content-type: application/json' -d '{"method":"eft"}'

# provider webhook confirms (add signature verification before production)
curl -X POST localhost:3000/api/payments/webhook/stitch \
  -H 'content-type: application/json' -d '{"gatewayRef":"stitch_<...>","status":"succeeded"}'
```

### Deposits (trust) + owner statements/payouts (agency)

- **Deposit trust flow** (`DepositService`): `capture` posts money into a segregated **Trust Bank** against a **Tenant Deposits (trust)** liability; `accrueInterest` credits interest owed to the tenant (RHA); `returnDeposit` refunds principal + interest less lawful deductions and classifies the outcome (returned / partially_returned / forfeited). Deposit money is never commingled with operating funds.
- **Owner statements + payouts** (`OwnerStatementService`): `generate` sums succeeded payments on the owner's leases for a period, nets the management fee **and owner-billable expenses**, and reclassifies the ledger `Dr Rental Income → Cr Management Fee Income + Cr Owner Payable + Cr Expense Recovery`; `payout` disburses via the provider (Paystack split/payout) and clears the liability `Dr Owner Payable / Cr Bank`. Owner money moves separately from the platform fee (PPRA — no gateway auto-split of client funds).
- **Expenses** (`ExpensesService`): `record` posts `Dr Property Expense / Cr Bank`. Owner-billable expenses fronted by the agency are pulled into the next owner statement (recovered via the Expense Recovery line, reducing net payout) and marked `reimbursed` so they're never double-counted. The statement stays ledger-balanced: `gross = fee + net + expenses`.

```bash
# capture a deposit into trust
curl -X POST localhost:3000/api/deposits/leases/<leaseId> -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' -d '{"amount":10000}'

# generate + pay out an owner statement
curl -X POST localhost:3000/api/owners/<ownerId>/statements/2026-07 -H 'authorization: Bearer <token>'
curl -X POST localhost:3000/api/owners/statements/<statementId>/payout -H 'authorization: Bearer <token>'
```

### Notifications (async, multi-channel)

Domain events fire notifications without blocking. `NotificationsService.enqueue()` drops a job on the `notifications` queue; `NotificationsProcessor` resolves the recipient + preferences (per-vendor via `TenantRunner`), computes allowed channels (opt-outs + quiet hours — quiet hours suppress push/SMS but not email), renders the template, delivers on each channel via a pluggable `ChannelProvider` registry (console stubs in dev; swap for an SA SMS gateway, SES/Postmark, FCM/APNs), and writes a per-channel delivery-log row.

Wired events: **rent invoice issued** → tenant; **payment received** → tenant; **rent overdue** (from dunning) → tenant. Templates and preference logic are pure and unit-tested. `NotificationsModule` has no dependency on billing (billing imports it), so there's no cycle.

### Documents + e-sign

- **Storage** is presigned-URL based — file bytes never pass through the API. `DocumentsService.requestUpload()` returns a presigned PUT URL and records metadata (auto-versioned per owner-entity + type); the client uploads straight to object storage and calls `confirm`. `getDownloadUrl()` returns a presigned GET, gated by the document's role **access scope** (`vendor_owner`/`platform_admin` always pass). `StorageProvider` is pluggable — a **local** dev stub by default, an **S3-compatible** provider (R2 / Hetzner / S3, via `STORAGE_DRIVER=s3`) for production.
- **E-sign** is webhook-driven and provider-agnostic (`EsignProvider`, native stub → swap for DocuSign/regional). `EsignService.requestSignature()` creates a request against a stored document and returns a signing link; the provider webhook advances the `SignatureRequest` status (sent → signed/declined/expired), idempotent by `providerRef`.
- Documents attach polymorphically to leases, users, units, tickets, or inspections. Storage-key building, expiry, and access-scope logic are pure and unit-tested.

### Listings + applicant funnel (Phase 3)

The path that actually fills a vacant unit: **listing → application → screening → approval → lease**. `ListingsService` publishes a vacancy; the public can browse published listings and `apply` (no auth). Managers move an application through `screen` (attaches a pure screening recommendation from income-to-rent ratio + credit score), then `approve` or `reject` — guarded by an explicit status-transition table (no illegal jumps, terminal states are terminal).

**Approval is the interesting bit** — it provisions the tenant end-to-end, atomically inside the request's tenant transaction: `IdentityService.ensureTenantUser` finds/creates the user and their `tenant` membership, `LeasingService.createLease` opens an active lease (now carrying `tenant_id`), `PropertiesService.setUnitStatus` flips the unit to occupied, and the listing is marked filled. The billing worklist function was updated to carry `tenant_id` through, so a newly-approved tenant automatically receives invoices and notifications on the next billing run. Screening and transition logic are pure and unit-tested; `listings` depends on leasing/properties/identity (never the reverse), so no cycle.

## Status

Phase-0 foundations, a full Phase-1 rent cycle, the complete Phase-2 agency money-flow, notifications, documents/e-sign, and the Phase-3 applicant funnel in place: modular monolith with **forced RLS**, tenant-scoped transactions (request + job), **OTP + JWT auth with role guards**, a **double-entry ledger**, **VAT-aware invoicing**, **BullMQ recurring billing + daily dunning**, **payment collection/allocation (Stitch)**, **deposit trust accounting**, **owner statements + split payouts (Paystack) with owner-billable expense recovery**, **async preference-aware notifications**, **presigned-storage documents + webhook e-sign**, and a **listings → application → screening → approval funnel** that provisions tenant + lease + occupies the unit. Verified: pure logic compiles under `tsc` and eleven unit suites pass — ZA policy, OTP crypto, double-entry engine, invoice math, payment allocation/late-fee, deposit return, owner-statement math, notification templating/preferences, document key/access, expense period/recovery, and screening/transitions.

End-to-end flows working: (1) publish listing → applicant applies → screened → approved → tenant + active lease provisioned, unit occupied; (2) lease → invoice (+VAT, notifies tenant) → Stitch payment clears AR (notifies) → overdue invoices accrue late fees (notifies); (3) deposit into segregated trust → interest owed to tenant → move-out return with lawful deductions; (4) rent collected on an owner's behalf → monthly statement (gross − mgmt fee − owner-billable expenses) reclassified in the ledger → Paystack payout clears the owner payable; (5) upload a lease to storage → send for e-signature → webhook marks it signed.
