# Partner Portal & Software-Sales Commission — Design Doc

Status: draft for review · Owner: Arthur · Depends on: #134 (subscription tiers)

## 1. Summary

Introduce **Partners** — resellers who sign new agencies onto the PMS and earn a
**recurring percentage of each referred agency's software subscription (MRR)** for
as long as that agency keeps paying. Partners are attributed **both** by a shared
referral link (agency self-signs-up) **and** by onboarding an agency directly from
their portal.

This is a platform-level feature and pulls in three things that don't exist yet:

1. **Vendor subscriptions / tiers** (the pending #134) — the software revenue a
   partner earns a cut of.
2. A **platform layer** above the per-vendor Row-Level-Security model.
3. The **Partner portal** and a **platform-admin** surface.

## 2. Terminology — Partners are not Agents

The existing `agents` feature is *rental referral agents*: vendor-scoped
(`TenantEntity`, RLS), earning `flat` / `percent_first_month` on tenant/property
referrals **inside one agency**. Do not extend it.

**Partners** are a new, platform-scoped concept: one partner spans many agencies
and earns on subscription revenue. New role: `partner`. New admin role:
`platform_admin` (us — the software owner).

| Concept        | Agent (existing)                | Partner (new)                         |
|----------------|---------------------------------|---------------------------------------|
| Scope          | One vendor (RLS)                | Platform (cross-vendor)               |
| Earns on       | Tenant/property referral        | Software subscription (MRR)           |
| Commission     | Flat / % first month, one-off   | Recurring % of MRR                    |
| Portal         | None (managed in back-office)   | Dedicated `/partner/*` portal         |

## 3. The architectural shift

Every table today is fenced to a vendor via `app.current_vendor_id` GUC + RLS. A
partner must read **across** vendors (their referred agencies), which RLS is
specifically designed to prevent. So partner/subscription data lives in
**platform-scoped tables with no RLS**, and access is enforced at the app layer:

- **Platform tables** (`partners`, `vendor_subscriptions`, `partner_commissions`)
  are plain entities (id + timestamps, **no `vendor_id` RLS policy**).
- A **`PartnerContext` guard** reads `partnerId` from the JWT and every partner
  service filters `WHERE partner_id = :self`. The client is never trusted for the
  partner id — it comes from the verified token only.
- **`platform_admin`** bypasses partner scoping and sees everything.
- Vendor-scoped code is untouched; RLS stays exactly as-is for tenant data.

This is a deliberate, documented exception to "RLS everywhere," justified because
the data is intentionally cross-tenant. Cross-vendor reads that must stay safe
(e.g. a partner's agency list joining vendor names) use the existing
`SECURITY DEFINER` function pattern already used for public listings/branding.

## 4. Subscription / tier model (the #134 foundation)

Commission needs revenue, so we define subscriptions first.

| Tier        | Price                     | Gate                    | MRR                         |
|-------------|---------------------------|-------------------------|-----------------------------|
| Starter     | Free                      | ≤ 10 units              | 0 (no commission)           |
| Growth      | R250 / unit / month       | > 10 units              | `unit_count × 250` *(a)*    |
| Enterprise  | Custom                    | Large / multi-branch    | Manually set MRR            |

`vendor_subscriptions` (1 row per vendor, history-friendly):

- `vendor_id`, `tier` (`starter|growth|enterprise`), `status`
  (`trialing|active|past_due|cancelled`), `unit_count` (monthly snapshot),
  `mrr` (computed / overridden for enterprise), `referred_by_partner_id` (nullable),
  `started_at`, `current_period` (`YYYY-MM`).

`unit_count` is snapshotted monthly from the vendor's active units. Real recurring
**billing** of the agency (charging the R250/unit) is a later phase — for the first
passes MRR can be computed and shown without money actually moving.

**Open decision (a):** does Growth bill *all* units at R250, or only units *above*
10? Affects MRR and therefore commission. Recommend: all units once over the
threshold, but make it a config constant.

## 5. Commission model — recurring % of MRR

- **Basis:** `partner_commission = rate% × vendor.mrr`, accrued **monthly** per
  referred, paying agency.
- **Rate:** a platform default (proposal: **10%**) with an optional per-partner
  override on the `partners` row.
- **Window:** lifetime vs a fixed term (e.g. 12 months). **Open decision** —
  recommend a `commission_months` field (null = lifetime) so it's per-partner.
- **No revenue → no commission:** Starter (MRR 0) accrues nothing; commission
  begins the first month the agency is on a paid tier.
- **Churn / downgrade:** accrual simply stops the next period; no negative clawback
  unless a payment is refunded (out of scope for v1).
- **Lifecycle:** mirror the existing agent-commission states —
  `pending → approved → paid` (+ `cancelled`), so the review/payout UX is familiar.

A monthly **platform job** (BullMQ, alongside the existing recurring-billing job)
computes each active paid subscription's MRR for the period and writes/updates a
`partner_commissions` row for the referring partner.

## 6. Attribution — both paths

Both funnel into a `vendor_subscriptions.referred_by_partner_id`.

**A. Referral link / code.** Each partner has a short `ref_code`. Public URL
`https://<marketing-or-app>/signup?ref=<code>` opens an **agency self-signup**
flow (new — doesn't exist yet) that creates the vendor + first `vendor_owner`
user + a `trialing` subscription tagged with the partner. Approval can be instant
or gated (open decision).

**B. Partner onboards.** The partner portal has an **"Add agency"** action that
creates the vendor + first admin on the agency's behalf, tagged to the partner.
Works today without any public signup flow — good first path to ship.

Guard rails: one attribution per vendor, set once at creation and immutable
thereafter (no re-attribution), to avoid disputes.

## 6.1 Sales pipeline & activity (from the mockup)

Partners work prospective agencies through a **kanban pipeline** (the uploaded
mockup, repurposed from a letting funnel to a software-sales funnel):

`Lead → Contacted → Demo → Trial → Proposal → Won → Lost`

- Each card is a `partner_deals` row (a prospective agency) with expected units /
  expected MRR so the pipeline shows a **Total Pipeline Value** (sum of open-deal
  expected MRR).
- Moving a card writes a `stage_change` **activity** and stamps `stage_changed_at`.
- **Won** links the deal to the created `vendor_id`; from then on the recurring
  commission engine (§5) takes over on that agency's real MRR. **Lost** captures a
  `lost_reason`.
- Every touch (call, email, demo, note) is logged as a `partner_activities` row and
  shown in an **activity feed**; recent activity also powers streak/last-active
  signals on the leaderboard.

Stage set is a config constant so it can be tuned without a migration.

## 6.2 Global leaderboard

Platform-wide ranking across **all** partners (the chosen scope), to drive healthy
competition. Because partner/subscription data is already platform-scoped, global
aggregation is natural — no cross-vendor RLS gymnastics.

- **Rank metrics** (selectable): agencies signed (period), referred MRR, commission
  earned, deals moved, demos held. Default: agencies signed this month.
- **Privacy:** partners see the ranked list of **display name + headline metric +
  rank + streak only** — never another partner's pipeline, contacts, or banking.
  Exposed via a read-only `SECURITY DEFINER` leaderboard function (same pattern as
  public listings/branding), so a partner token can read the aggregate without
  seeing raw platform tables.
- Period windows: this month / this quarter / all-time, plus a "movers" view.
- Optional later: badges/tiers (e.g. Bronze/Silver/Gold by lifetime agencies),
  monthly reset with a hall-of-fame.

## 7. Data model

All platform-scoped (no RLS). Next migration number: **1720000027000**.

**`partners`**
`id, name, contact_email, contact_phone, company, ref_code (unique), status
(pending|active|suspended), commission_rate (numeric, default platform rate),
commission_months (int null = lifetime), banking (jsonb, encrypted via pii-crypto),
notes, created_at, updated_at`

**`partner_members`** (a login belongs to a partner — mirrors vendor memberships)
`id, partner_id, user_id, role ('partner_owner'), created_at`

**`vendor_subscriptions`**
`id, vendor_id (unique), tier, status, unit_count, mrr, referred_by_partner_id
(null), current_period, started_at, updated_at`

**`partner_commissions`**
`id, partner_id, vendor_id, period (YYYY-MM), basis_mrr, rate, amount, status
(pending|approved|paid|cancelled), approved_at, paid_at, paid_ref, created_at`

**`partner_deals`** (the sales pipeline — one prospective agency)
`id, partner_id, prospect_name, contact_name, contact_email, contact_phone,
stage (lead|contacted|demo|trial|proposal|won|lost), expected_units,
expected_mrr, source (referral_link|manual), lost_reason, vendor_id (set when
won → the created agency), created_at, updated_at, stage_changed_at`

**`partner_activities`** (feeds the activity feed + "streak" signals)
`id, partner_id, deal_id (null), type (call|email|demo|note|stage_change|signup),
summary, created_at`

## 8. Auth & roles

- New roles: `partner` (portal), `platform_admin` (us).
- JWT gains an optional `partnerId` claim; a partner token has `partnerId` set and
  `vendorId` null. A platform-admin token has neither.
- OTP login resolution (`auth_memberships_for_user`) is extended: if the user has a
  `partner_members` row, issue a partner token; a designated platform-admin list
  (env or a `platform_admins` table) issues an admin token.
- The RLS interceptor already sets an empty vendor GUC when `vendorId` is null —
  fine, because platform tables aren't RLS-guarded. Partner scoping is done by the
  `PartnerContext` guard, not the database.

## 9. Surfaces

**Partner portal** (`/partner/*`, mirrors the existing owner portal pattern —
its own `PARTNER_NAV`, role-gated in `shell.tsx`):

- **Overview** — metric cards mirroring the mockup: Total Pipeline Value,
  Agencies Signed, Demos This Week, Active Deals, plus Commission MTD / Pending /
  Paid; and the partner's current leaderboard rank + streak.
- **Pipeline** — the `Lead→…→Won/Lost` kanban of prospective agencies (§6.1); drag
  to move stage, add deals, edit expected units/MRR.
- **Activity** — chronological feed of the partner's calls/emails/demos/notes and
  stage changes; quick "log activity" action.
- **Leaderboard** — global ranking (§6.2) with period toggle and the partner's own
  highlighted row.
- **Agencies** — their referred, live agencies: name, tier, unit_count, MRR,
  status, joined.
- **Referral** — their `ref_code`, copyable signup link, share text.
- **Add agency** — onboard a new agency directly (attribution B) — creates a `won`
  deal + the vendor in one step.
- **Commissions** — monthly accruals with pending/approved/paid.
- **Banking** — payout details (encrypted, masked; reuse owner-banking flow).

**Platform admin** (new `/admin/*` surface, `platform_admin` only):

- **Partners** — CRUD, approve, set rate/window, suspend.
- **Subscriptions** — all vendors, tiers, MRR; set Enterprise MRR; correct
  unit_count; move tiers.
- **Commission runs** — preview/trigger the monthly accrual, approve, mark paid
  with a payout reference.
- **Tiers config** — price per unit, free threshold, default partner rate.

## 10. Payouts

v1: manual — platform admin approves accrued commissions and marks them paid with
an EFT reference (same shape as the owner-payout flow). Automated payouts to
partner bank accounts are a later phase.

## 11. Security / POPIA

- Platform tables have no RLS, so **app-layer authorization is load-bearing** —
  every partner query filters by the token's `partnerId`; add tests that assert a
  partner cannot read another partner's agencies or commissions.
- Partner banking encrypted at rest (`pii-crypto`), masked in responses.
- Partners see agency **names + aggregate MRR/unit counts only** — never tenant
  PII, leases, or financials inside an agency.
- Instant-revocation session model already in place applies to partner tokens too.

## 12. Phasing / rollout

- **Phase 0 — Subscriptions (#134).** `vendor_subscriptions`, tier + MRR calc,
  admin sets/reviews tier per vendor. No money moves yet.
- **Phase 1 — Partners + portal + pipeline.** `partners`, `partner_members`,
  roles, `PartnerContext` guard, attribution B (portal onboarding), the sales
  pipeline (`partner_deals`) with kanban + activity feed (`partner_activities`),
  the global leaderboard function, partner dashboards, and platform-admin partner
  management. This is the mockup, made real.
- **Phase 2 — Commissions.** Monthly accrual job, `partner_commissions`,
  statements, approve/mark-paid, partner banking.
- **Phase 3 — Referral self-signup + real billing.** Public `/signup?ref=` agency
  flow (attribution A) and actual recurring SaaS billing of agencies (iKhokha /
  PayFast subscription), which makes MRR real money.

Each phase is independently shippable; Phases 0–2 deliver a working partner program
on manually-tracked (but computed) MRR before real subscription billing exists.

## 13. Decisions (locked)

1. **Growth billing = all units × R250** once over the 10-unit threshold.
   `mrr = unit_count × 250` when `unit_count > 10`, else 0 (Starter).
2. **Commission rate 10%, window lifetime.** Per-partner overrides allowed
   (`commission_rate`, `commission_months = null` for lifetime).
3. **Referral self-signup is admin-approved** — a `ref` signup creates a
   `pending` agency/subscription that a platform admin activates.
4. **Single platform admin (you), env-listed** — `PLATFORM_ADMIN_EMAILS` grants
   the `platform_admin` role at login; no `platform_admins` table yet.
5. **Payouts: manual EFT (v1)** — admin approves and marks paid with a reference;
   automate later.

Config constants (one place, tunable): `GROWTH_PRICE_PER_UNIT=250`,
`FREE_UNIT_THRESHOLD=10`, `PARTNER_DEFAULT_RATE=0.10`.
