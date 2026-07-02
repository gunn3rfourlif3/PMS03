# Property Management Platform — Improved Product Specification

*Multi-vendor, white-label, mobile-first rental management for landlords, agencies, and tenants.*

This document evaluates the original **TalandanOs** spec and rebuilds it into a buildable specification. It is organized as: (1) an honest evaluation of the original, (2) the gaps that must be closed, (3) a corrected technical architecture, (4) a concrete data model, and (5) a phased MVP-to-scale roadmap.

---

## Part 1 — Evaluation of the Original Spec

### What the original got right

The original is a strong *vision* document. Its instincts are good in several places:

- **Correct multi-tenancy framing.** Separating global admin, per-vendor branding, and a shared core is the right mental model for a white-label SaaS.
- **Sensible domain decomposition.** The five modules (Identity, Real Estate, Lease, Billing, Operations) map cleanly to how the business actually works.
- **Right data-modeling instincts.** Using JSONB for flexible unit attributes, a status state-machine for units, and a defined work-order lifecycle are all mature choices.
- **Mobile-first is genuinely treated as first-class**, not bolted on.
- **The white-label config table** (branding, domains, feature flags, localization) is the correct set of levers.

### Where the original falls short

The core problem: **it reads like an architecture pitch, not a build spec.** It over-invests in infrastructure buzzwords and under-invests in the domain logic that actually makes a property platform hard. Specifically:

1. **Premature architectural complexity.** Microservices, Kafka, edge workers, and schema-per-vendor sharding are proposed *before a single tenant exists*. This is the most common way early platforms die — you spend your runway operating distributed infrastructure instead of shipping features. (Detailed in Part 3.)
2. **The financial engine is dramatically underspecified.** "Automated Ledger" is one bullet. In reality, money movement, double-entry accounting, reconciliation, refunds, deposits held in trust, and tax are 50%+ of the real product complexity and 90% of the legal risk. (Part 2 & 4.)
3. **No data model.** There are entity *names* scattered through prose but no entities, relationships, or key fields defined. You cannot build or estimate from this. (Part 4.)
4. **Missing entire domains.** No accounting/GL, no document management, no communications/messaging, no reporting/analytics beyond "pocket analytics," no audit trail, no notifications infrastructure, no vacancy/listing/applicant funnel, no inspections data model, no compliance/regulatory layer. (Part 2.)
5. **Hand-waves the hardest integration: payments.** "Split-payment gateways" glosses over KYC/onboarding of vendors as sub-merchants, payout scheduling, chargebacks, and regional rails (which differ enormously by market). (Part 2 & 3.)
6. **No non-functional requirements.** Nothing on security posture beyond RLS, nothing on data residency, backups, DR, SLAs, observability, or rate limiting.
7. **No roadmap.** Everything is presented as equally important and simultaneously built, which is not a plan. (Part 5.)

**Bottom line:** keep the domain decomposition and the white-label model. Throw out the premature distributed-systems architecture. Add the accounting, documents, comms, and compliance domains it forgot. Then sequence it.

---

## Part 2 — Gaps & Missing Features

The original covers Identity, Properties, Lease, Billing, and Maintenance. Below are the domains and features it omits, grouped by priority.

### Critical gaps (the platform is not credible without these)

**Accounting & general ledger.** Billing is not accounting. You need a double-entry ledger so that every invoice, payment, refund, deposit, late fee, and payout is a balanced transaction. Without it you cannot produce a trustworthy owner statement, reconcile a bank account, or survive an audit. This is the single biggest omission.

**Trust / escrow accounting for deposits and rent.** In most jurisdictions, tenant deposits (and sometimes rent held on behalf of owners) must be held in segregated trust accounts and cannot be commingled with operating funds. This is a legal requirement, not a feature — and it directly shapes the data model.

**Owner / landlord statements & payouts.** For the agency use case, the platform collects rent on behalf of property owners, deducts management fees and expenses, and remits the balance. This monthly owner-disbursement flow is core and entirely absent.

**Document management.** Leases, IDs, inspection reports, invoices, receipts, insurance certificates, compliance certificates — all need versioned storage, access control, expiry tracking, and links to the entities they belong to.

**Communications / messaging.** A shared inbox and threaded messaging between tenant ↔ manager ↔ contractor, tied to units and tickets, with an audit trail. Property management is fundamentally a communications business.

**Notifications infrastructure.** The original mentions push/SMS in passing but there's no notion of a notification service: templated, multi-channel (push, SMS, email, WhatsApp, in-app), per-user preferences, delivery tracking, and quiet hours.

**Audit log.** Immutable record of who changed what and when — required for finance, disputes, and compliance.

### Important gaps (needed before scale, not day one)

**Listings & applicant funnel.** Vacancy management → public/listing pages → applications → screening → approval → lease. The original jumps straight to an existing tenant; it skips how a unit gets filled.

**Inspections (as data, not just a camera).** Move-in / move-out / periodic inspections with structured checklists, photos per item, condition ratings, tenant sign-off, and a diff between move-in and move-out to justify deposit deductions.

**Reporting & analytics.** Beyond "pocket analytics": rent roll, arrears aging report, occupancy trends, collection rate, expense breakdowns, owner P&L, exportable to CSV/PDF. Ideally a per-vendor configurable dashboard.

**Expense & vendor-bill tracking.** Maintenance costs money. You need to record contractor bills, categorize expenses, attach them to units/tickets, and flow them into owner statements.

**Compliance & regulatory layer.** Rent control caps, mandated notice periods, safety certificate tracking (gas/electrical/fire depending on region), fair-housing considerations, and per-jurisdiction rules. This should be a configurable policy layer, not hard-coded.

**Utilities & metering.** The original mentions sub-meters; expand to meter readings, tariff schedules, prepaid vs. postpaid, and reading-to-invoice automation.

### Nice-to-have / differentiators (later phases)

Renters/contents insurance offers, credit-building via rent reporting, tenant rewards/loyalty, IoT smart-lock and smart-meter integration, AI-assisted maintenance triage and rent-arrears prediction, a public API + webhooks for vendor integrations, and an accounting-software sync (QuickBooks/Xero).

### Cross-cutting non-functional requirements (entirely missing)

Security (encryption at rest/in transit, secrets management, PII minimization, penetration testing), data residency & privacy (GDPR/POPIA/CCPA data-subject requests, retention policies), backups & disaster recovery (RPO/RTO targets), observability (structured logs, metrics, tracing, error tracking), rate limiting and abuse prevention, and defined SLAs/SLOs per tenant tier.

---

## Part 3 — Technical Architecture Critique & Recommendation

### The core critique: right destination, wrong starting point

The original's architecture is where a successful platform *might* end up at significant scale — but adopting it on day one is a serious mistake. Concretely:

- **Microservices from the start** multiply operational surface (deployment, networking, distributed tracing, data consistency across service boundaries) at exactly the moment you have the least engineering capacity and the most product uncertainty. Service boundaries also tend to be wrong early because the domain isn't fully understood yet.
- **Kafka** is enormous overkill for "generate 10,000 invoices." A background job queue handles that comfortably. Kafka is an event-streaming backbone you adopt when you have many services that need a durable event log — not a batch-job runner.
- **Schema-per-vendor sharding** creates painful migration operations (every schema change runs N times), complicates cross-tenant admin queries and analytics, and is hard to reverse. Row-Level Security on a shared schema gives you strong isolation with a fraction of the operational cost.
- **"Sub-millisecond edge routing"** is a solution to a problem you do not have. Tenant resolution from a hostname is a cache lookup measured in single-digit milliseconds regardless.

### Recommended architecture: modular monolith first

Build a **modular monolith** with clean internal module boundaries that *mirror the domains* — Identity, Properties, Leasing, Billing, Accounting, Maintenance, Documents, Comms, Notifications. Each module owns its tables and exposes an internal service interface; modules never reach into each other's tables directly. This gives you the *modularity* the original wanted (you can extract any module into a service later) without paying the distributed-systems tax now. Extract a service only when a specific module has a proven, independent scaling or team-ownership need.

**Multi-tenancy:** single Postgres database, **shared schema with Row-Level Security**, `vendor_id` on every tenant-scoped table, enforced by RLS policies keyed off the authenticated session's vendor claim. RLS scales well *if* it's applied with discipline — but it demands it: **every** table needs its policy, **every** request must set the tenant session variable, and a single missing policy is a silent cross-tenant data leak. Because of that failure mode, do not rely on RLS alone — add a **defense-in-depth application-layer tenant scope** (belt and suspenders) so a bug can't leak across tenants even if an RLS policy is forgotten. Enforce policy coverage in CI (a test that fails if any tenant-scoped table lacks an RLS policy). Revisit schema-per-tenant only for specific enterprise customers with contractual data-isolation requirements.

**White-label:** tenant resolved from hostname/custom domain at the edge or app-entry middleware → tenant config (theme, logo, fonts, feature flags, locale, currency, tax profile) fetched once and cached (Redis, short TTL). Frontend receives a theme payload and renders dynamically. Custom domains via a wildcard-cert / SaaS-domain provider (e.g. Cloudflare for SaaS) with automated SSL.

### Recommended stack (pragmatic)

- **Backend:** a single well-structured **Node.js/TypeScript** service on **NestJS** (recommended). The whole architecture bet is "modular monolith with boundaries clean enough to extract services later" — NestJS enforces those module boundaries as a first-class concept, which is exactly the property you're protecting. A lighter framework like Fastify gives you a faster server but not structure; you'd hand-roll the module conventions and they tend to rot under deadline pressure. Throughput isn't your Phase-1 bottleneck (Postgres, the payment provider, and domain logic are), and NestJS can run on a Fastify adapter later if you want the speed. **Python/Django** is a fine alternative if that's your team's strength — pick for team familiarity, but default to NestJS.
- **Database:** **PostgreSQL** with RLS (keep this from the original — it was right). Use a mature migration tool. **Redis** for caching, sessions, and as the queue backend.
- **Background jobs:** a robust job queue (**BullMQ** on Redis, or the framework-native equivalent). This covers invoice generation, dunning, notifications, and report exports. No Kafka.
- **Frontend:** **React Native / Expo** for the tenant + landlord mobile apps. This product's core loops are payments, push notifications, and camera-heavy inspections — exactly the areas where Expo's native handling beats a PWA, so it's worth more than the few weeks a shortcut might save. A **Next.js** web app for the admin/agency back-office and public listing pages. Share a design-system and API client between them. *Exception:* if you're throwing a throwaway prototype at users purely to validate demand, a mobile-first Next.js PWA wrapped in Capacitor can reach Phase 1 faster — but don't build the product you intend to keep on that path.
- **Payments:** integrate a provider that natively supports **marketplace / connected-account split payments** (Stripe Connect, or a regional equivalent that supports sub-merchant onboarding and payouts) rather than building split logic yourself. Vendor onboarding (KYC/AML for sub-merchants) is a first-class flow, not an afterthought.
- **Infra:** start on a managed platform (managed Postgres + container hosting). Add a CDN for assets and edge domain routing. Adopt Kubernetes/microservices only when scale demands it.
- **Observability from day one:** structured logging, error tracking (e.g. Sentry), metrics, and uptime monitoring.

### Architecture at a glance

```
                 ┌─────────────────────────────┐
                 │   Global Admin / Platform    │
                 └──────────────┬──────────────┘
                                │
              Custom domains (rent.vendor-a.com, ...)
                                │
                 ┌──────────────▼──────────────┐
                 │  Edge / Domain + Tenant      │
                 │  Resolution (cached config)  │
                 └──────────────┬──────────────┘
                                │
          ┌─────────────────────▼─────────────────────┐
          │        Modular Monolith (one deploy)       │
          │  Identity │ Properties │ Leasing │ Billing │
          │  Accounting │ Maintenance │ Docs │ Comms   │
          │  Notifications │ Reporting                  │
          └───────┬───────────────┬───────────────┬────┘
                  │               │               │
          ┌───────▼──────┐ ┌──────▼─────┐ ┌───────▼──────┐
          │ PostgreSQL   │ │  Redis +   │ │  Object      │
          │ (shared + RLS│ │  Job Queue │ │  Storage     │
          │  vendor_id)  │ │            │ │  (docs/media)│
          └──────────────┘ └────────────┘ └──────────────┘
                  │
          ┌───────▼───────────────────────────────────┐
          │  External: Payments (Connect), E-sign,     │
          │  SMS/WhatsApp/Email, KYC, Maps             │
          └────────────────────────────────────────────┘
```

---

## Part 4 — Data Model

Core entities with their most important fields. Every tenant-scoped table carries `vendor_id` (omitted below for brevity except where noted) and standard `id`, `created_at`, `updated_at` columns.

**Two data-integrity rules govern this model:**

1. **Soft delete is not universal — financial and audit tables are immutable.** Operational tables (Property, Unit, Room, Listing, Document, Ticket, etc.) carry a `deleted_at` soft-delete column. Financial tables (**LedgerEntry, Invoice, Payment, Deposit, Payout, OwnerStatement**) and the **AuditLog** are strictly append-only: they are *never* updated or soft-deleted. Correct a mistake with a **reversing entry**, not an edit. This is what keeps the books auditable and the ledger trustworthy.
2. **JSONB is for genuinely variable data only.** Use JSONB for open-ended, per-type attributes (amenities, custom fields, theme config). Anything you filter, sort, aggregate, or report on — `status`, rent/price, dates, region/locale keys — must be a strongly-typed, indexed column, not a JSONB field. Rule of thumb: if it appears in a `WHERE` or `ORDER BY`, it does not belong in JSONB.

### Identity & tenancy

- **Vendor** *(the "tenant" of the SaaS — a landlord or agency)* — `id`, `name`, `type` (individual_landlord | agency), `status`, `config` (JSONB: theme, feature_flags, locale), `default_currency`, `custom_domain`, `subscription_tier`.
- **User** — `id`, `vendor_id` (nullable for platform admins), `name`, `email`, `phone`, `auth_provider`, `status`. A user may belong to one vendor context but can hold a tenant role elsewhere; model cross-vendor access via memberships.
- **Membership / Role** — `id`, `user_id`, `vendor_id`, `role` (platform_admin | vendor_owner | property_manager | tenant | contractor), `scope` (JSONB: e.g. limited to specific properties/permissions). Enables granular RBAC.

### Real estate

- **Property** — `id`, `vendor_id`, `name`, `address`, `geo`, `type` (building | complex | single_unit | co_living), `owner_id` (→ Owner), `attributes` (JSONB).
- **Unit** — `id`, `property_id`, `label`, `floor`/`block`, `bedrooms`, `bathrooms`, `size`, `status` (vacant | occupied | maintenance | reserved | offline), `market_rent`, `attributes` (JSONB).
- **Room** — `id`, `unit_id`, `label`, `status`, `market_rent` — for co-living / room-share; a Room is independently leasable.
- **Owner** — `id`, `vendor_id`, `name`, `contact`, `payout_details`, `management_fee_pct`. (For agencies managing on behalf of owners. A single landlord may be both Vendor and Owner.)

### Leasing

- **Listing** — `id`, `unit_id`/`room_id`, `advertised_rent`, `available_from`, `status`, `media`, `description`.
- **Application** — `id`, `listing_id`, `applicant` (→ User/prospect), `status` (submitted | screening | approved | rejected | withdrawn), `screening_result` (JSONB), `documents`.
- **Lease** — `id`, `unit_id`/`room_id`, `type` (fixed | month_to_month | co_living), `status` (draft | active | ending | ended | terminated), `start_date`, `end_date`, `rent_amount`, `billing_cycle`, `escalation` (JSONB: e.g. +10%/yr), `deposit_terms`, `esign_status`, `document_id`.
- **LeaseTenant** — join of `lease_id` ↔ `user_id` with `share_pct` / responsibility, for co-tenancies.

### Billing & accounting

- **Account (GL)** — `id`, `vendor_id`, `type` (asset | liability | income | expense | equity), `name`. Includes trust/escrow accounts flagged distinctly.
- **LedgerEntry / JournalLine** — double-entry: `id`, `transaction_id`, `account_id`, `debit`, `credit`, `entity_ref` (lease/tenant/owner), `posted_at`. Every financial event posts a balanced transaction.
- **Invoice** — `id`, `lease_id`, `tenant_id`, `period`, `due_date`, `status` (draft | issued | partly_paid | paid | overdue | void), `total`, `line_items` (rent, utilities, levies, late_fee).
- **Payment** — `id`, `invoice_id`(s), `tenant_id`, `amount`, `method`, `gateway_ref`, `status`, `received_at`, `allocation` (which invoices/lines it settled).
- **Deposit** — `id`, `lease_id`, `amount`, `held_in` (trust account), `status` (held | partially_returned | returned | forfeited), `deductions` (→ inspection findings).
- **Charge / Recurring charge template** — configurable line items a lease generates each cycle.
- **OwnerStatement** — `id`, `owner_id`, `period`, `gross_collected`, `fees`, `expenses`, `net_payout`, `payout_status`, `line_items`.
- **Payout** — `id`, `owner_id`/`vendor_id`, `amount`, `gateway_ref`, `status`, `scheduled_for`.

### Operations

- **Ticket / MaintenanceRequest** — `id`, `unit_id`, `reporter_id`, `category`, `priority`, `description`, `media`, `status`.
- **WorkOrder** — `id`, `ticket_id`, `contractor_id`, `status` (open | assigned | in_progress | completed | tenant_approved | invoiced), `scheduled_for`, `cost`, `expense_id`.
- **Inspection** — `id`, `unit_id`, `lease_id`, `type` (move_in | move_out | periodic), `checklist` (JSONB items with condition + photos), `tenant_signoff`, `report_document_id`.
- **Expense** — `id`, `vendor_id`, `property_id`/`unit_id`, `category`, `amount`, `vendor_bill_ref`, `owner_billable` (bool), `document_id`.

### Cross-cutting

- **Document** — `id`, `vendor_id`, `owner_entity` (polymorphic: lease/user/unit/ticket/inspection), `type`, `storage_url`, `version`, `expiry_date`, `access_scope`.
- **Message / Thread** — `id`, `thread_id`, `participants`, `entity_ref` (unit/ticket/lease), `body`, `attachments`, `read_receipts`.
- **Notification** — `id`, `user_id`, `channel`, `template`, `payload`, `status` (queued | sent | delivered | failed), `sent_at`. Plus **NotificationPreference** per user/channel/type.
- **AuditLog** — `id`, `vendor_id`, `actor_id`, `action`, `entity_ref`, `before`/`after` (JSONB), `at`. Append-only.

### Entity relationship sketch

```
Vendor 1─* User 1─* Membership
Vendor 1─* Property 1─* Unit 1─* Room
Owner 1─* Property                (agency-managed)
Unit/Room 1─* Listing 1─* Application
Unit/Room 1─* Lease *─* User      (via LeaseTenant)
Lease 1─* Invoice 1─* Payment
Lease 1─1 Deposit
Owner 1─* OwnerStatement 1─1 Payout
Unit 1─* Ticket 1─* WorkOrder ─1 Contractor
Lease 1─* Inspection
* entities 1─* Document / Message / Notification / AuditLog
Every financial event ⇒ balanced LedgerEntry set
```

---

## Part 5 — Phased Roadmap (MVP → Scale)

The original presents everything as simultaneous. Here is a sequence that gets to revenue fastest while keeping the modular boundaries intact.

### Phase 0 — Foundations (weeks 0–4)

Multi-tenant skeleton: Vendor/User/Membership, RLS, auth (passwordless OTP + one social), the white-label config resolver and theming, and the modular-monolith scaffold with observability and CI/CD. **Deliverable:** a branded, empty app you can log into as different roles under different vendors.

### Phase 1 — Core MVP (weeks 4–12): "collect rent"

The narrowest thing that delivers value to a single landlord.

- Properties → Units → (Rooms) with the status engine.
- Leases (fixed + month-to-month) with a document upload (defer e-sign).
- Billing: recurring rent invoice generation via the job queue, tenant views invoice, **one** payment integration (single-vendor payout, defer split).
- The double-entry ledger underneath from day one — retrofitting accounting later is agony.
- Tenant mobile app: dashboard, pay rent, view lease. Landlord mobile: occupancy + rent-collected + arrears at a glance.
- Notifications: rent-due and payment-received (push + email).

**Deliverable:** a landlord can onboard a building, place tenants, and collect rent through the app.

### Phase 2 — Operations & agencies (weeks 12–20)

- Maintenance: tickets → work orders → contractor role.
- Documents module + e-sign integration for leases.
- Owner entities, owner statements, expenses, and the split-payment / owner-payout flow (the agency use case).
- Dunning & late-fee engine.
- Messaging between tenant/manager/contractor.
- Move-in/move-out inspections wired to deposit deductions.

**Deliverable:** an agency can manage properties on behalf of multiple owners and get paid out correctly.

### Phase 3 — Growth & configurability (weeks 20–32)

- Listings + applicant funnel + screening.
- Reporting suite (rent roll, arrears aging, owner P&L, exports).
- Full feature-flag/module toggling per vendor; localization (multi-currency, timezones, tax profiles).
- Trust-account handling formalized per jurisdiction; compliance/policy layer (notice periods, rent caps, certificate tracking).
- Custom-domain self-service with automated SSL.

### Phase 4 — Scale & differentiation (32+)

- Extract high-load modules into services **only where measured need exists** (likely Notifications and Billing first).
- Public API + webhooks; accounting-software sync.
- AI-assisted maintenance triage and arrears prediction; IoT locks/meters; insurance and rent-reporting add-ons.

### Sequencing principles

Build the ledger before you build fancy billing. Ship single-vendor payments before split payments. Prove one landlord's workflow before the agency's multi-owner workflow. Keep module boundaries clean so extraction is cheap — but don't extract until the data tells you to.

---

## Summary of Changes vs. Original

| Area | Original | Improved |
| --- | --- | --- |
| Architecture | Microservices + Kafka + edge workers + schema sharding, day one | Modular monolith, shared-schema RLS, job queue; extract later |
| Accounting | One "ledger" bullet | Full double-entry GL, trust accounts, owner statements, payouts |
| Data model | Entity names in prose | ~25 defined entities with fields + relationships |
| Missing domains | — | Documents, comms, notifications, listings/funnel, inspections-as-data, reporting, expenses, compliance, audit |
| Payments | "Split gateways" hand-wave | Connected-account provider, KYC onboarding, single→split sequencing |
| Non-functionals | Absent | Security, residency, backups/DR, observability, SLAs |
| Plan | Everything at once | 5 phases from "collect rent" to scale |

---

## Appendix A — South Africa Launch Blueprint

The initial launch market is **South Africa**. This changes several defaults from the generic spec above. All rules below are implemented as a **ZA policy module** selected via `vendor.config` (the *selection* is config; the *logic* is typed, tested code).

### A.1 — Payments (SA rails)

Do not default to a card-first / Stripe-Connect design. In South Africa, **instant EFT / pay-by-bank is a dominant rail** and is cheaper per transaction than cards.

- **Phase 1 (single landlord, no split):** lead with an EFT-first provider — **Stitch** (developer-first, marketplace-oriented, instant EFT + payouts) or **Ozow** — with card acceptance as a secondary method.
- **Phase 2 (agency split payouts):** add split/subaccount capability. **Paystack's Transaction Splits / subaccounts API** is the most mature and clearly documented for "collect once, settle platform + vendor simultaneously" (percentage or flat, multi-split). **Peach Payments** is a strong option if subscriptions dominate.
- Because everything sits behind the `PaymentProvider` interface, start on one provider and add the split provider later. **Validate split ergonomics in each provider's sandbox before committing** — provider docs settle capability, not fit.

> **Trust-money constraint (see A.3):** do **not** rely on provider "auto-split platform fee out of every payment" for money that belongs to owners/tenants. Route client money into the trust structure first; settle the platform fee separately.

### A.2 — Data residency & hosting

- **App + Redis** on **Hetzner EU** (Falkenstein/Helsinki) via Coolify/Kamal.
- **Postgres** on a **managed EU provider** (Aiven / DigitalOcean / Crunchy Bridge) for automated PITR, backups, and failover. POPIA permits this cross-border arrangement; EU hosting aligns with its data-protection standard.
- Accept ~150–180ms latency to SA users; mitigate with a CDN and Expo's offline-friendly patterns if it becomes a real complaint.
- Documents/inspection photos in S3-compatible storage (Cloudflare R2 or Hetzner Object Storage).
- **POPIA obligations still apply regardless of hosting location:** lawful basis, data-subject access/deletion flows, and a retention policy are required product features, not just infra settings.

### A.3 — Property Practitioners Act (PPA / PPRA) — reshapes money flow

Anyone who collects rent **on behalf of** a landlord (your agency vendors, and potentially the platform depending on fund flow) is a "property practitioner" and must hold a valid **Fidelity Fund Certificate (FFC)** and operate a **separate, annually-audited trust account** (PPA s54).

- **Vendor onboarding** must capture and verify **FFC status**, and **gate the "collect rent on behalf of owners" feature on a valid, in-date FFC.** Model FFC validity as a hard precondition flag on the Vendor/Owner relationship.
- **No commingling:** trust money (rent + deposits belonging to owners/tenants) must not mix with the platform's operating/fee accounts in transit. This is why the ledger is append-only and trust accounts are modelled distinctly (Part 4).

### A.4 — Deposits (Rental Housing Act s5(3))

- Deposit must be held in an **interest-bearing account**; **accrued interest is owed to the tenant.**
- Provide the tenant **written proof of the account and interest rate within 14 days** of receipt.
- **Refund timelines:** 7 days (no deductions), 14 days (deductions after joint inspection), 21 days (tenant failed to attend joint inspection).
- **Schema impact — `Deposit` entity gains:** `held_in` (interest-bearing trust account ref), `interest_accrued` (tracked over time, posted to the ledger as a **liability to the tenant**), `proof_sent_at`, and the return workflow enforces the statutory day-counts and ties deductions to the move-out inspection diff.

### A.5 — First policy module (concrete)

```
vendor.config = {
  tax_profile:             "ZA_VAT",     // 15% VAT
  deposit_policy:          "ZA_RHA",     // interest-bearing, 7/14/21-day returns
  practitioner_compliance: "ZA_PPRA"     // FFC gating + trust-account rules
}
```

Rules live in typed, unit-tested code (`ZaVatTaxProfile`, `ZaRhaDepositPolicy`, `ZaPpraCompliancePolicy`); `vendor.config` only selects which profile applies. Adding a second market later = a new set of profile implementations behind the same interfaces.

### A.6 — Sources

- Rental deposit rules — Rental Housing Act s5(3): https://www.privateproperty.co.za/advice/property/articles/legal-requirements-for-rental-deposits-in-south-africa/9382
- Deposit interest-bearing account requirement: https://www.timeslive.co.za/sunday-times-daily/news/2025-08-14-landlords-obligated-to-place-tenants-deposit-in-interest-bearing-account-experts-unpack-deposit-disputes/
- PPRA — trust accounts & Fidelity Fund Certificates: https://theppra.org.za/disciplinaries/trust_account_of_and_investment_of_trust_monies_by_an_estate_agent
- Property Practitioners Act summary (FFC + trust obligations): https://www.findanattorney.co.za/content_property-practitioners-act
- Paystack Transaction Splits / multi-split API: https://paystack.com/docs/payments/multi-split-payments/
- Stitch — SA payments for marketplaces: https://stitch.money/
- SA payment gateways 2026 overview: https://sashares.co.za/payment-gateways/
