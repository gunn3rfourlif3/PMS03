# Locare — agency onboarding console

Written 2026-09-10. Owner: Vernon. Status: **Phase 1 built** (tracker); phases 2–4 outstanding.

Implements **R-7** (nothing tracks where an agency is in onboarding) and **R-9**
(a per-agency preflight) from `LOCARE_AGENCY_ONBOARDING_REQUIREMENTS.md`. The
procedure itself is not redesigned here: `LOCARE_AGENCY_ONBOARDING_RUNBOOK.md`
stays the source of truth for *what* the stages are. This is the machine that
tracks and proves them.

---

## 1. The problem, stated as it actually bites

Today an onboarding lives in one person's head and a markdown file. Three
consequences, all from the requirements doc:

- **Handover is a conversation.** Nobody can pick up a half-finished onboarding.
- **A stall is invisible.** An agency waiting three weeks on its own DNS
  controller looks identical to one being actively worked.
- **"Done" is an opinion.** The runbook has gates; nothing enforces them, so an
  operator can believe a stage is complete and be wrong.

## 2. Principles

**Verify, don't assert.** Any item the system can check, it checks. A tick is
reserved for things only a human can attest to — "staff trained", "the principal
agreed the owner statement is correct" — and those render differently, with the
person's name against them.

**Never a second source of truth.** A checklist claiming TLS is fine while a host
is broken is worse than no checklist. If an item is verifiable and the check has
not run, it is not green.

**Honest progress.** The bar reflects weighted effort and says who it is waiting
on. Stage 5 is half the work; a bar that treats nine stages as nine equal steps
lies twice — once by reaching 55% in an afternoon, and again by sitting still for
three days.

**The checklist marks itself where it can.** The first imported unit completes
5.1. The first settled rent run completes 8.1. Nobody ticks what the system can
observe.

## 3. Non-goals

- Not project management. Nine stages, one versioned template, no custom fields.
- Not the agency-facing wizard. That is a later phase over the same records
  (§10), deliberately not designed here.
- Not the CSV importer (R-5). The requirements doc is explicit that the importer
  must not be built before the domain work (R-1) lands.

---

## 4. Data model

One table. Migration `1720000046000-AgencyOnboarding`.

```
agency_onboarding_items
  id                uuid pk
  vendor_id         uuid  not null            -- platform-scoped, no RLS
  template_version  text  not null            -- e.g. 'runbook-2026-09'
  stage             int   not null            -- 0..9
  item_key          text  not null            -- e.g. '2.3-cors-origins'
  title             text  not null
  status            text  not null            -- pending|in_progress|blocked|done|skipped|failed
  waiting_on        text  not null            -- locare|agency|third_party
  verifiable        bool  not null            -- has an automated check
  weight_hours      numeric not null          -- drives the progress bar
  owner_user_id     uuid  null
  completed_by      uuid  null
  completed_at      timestamptz null
  evidence          jsonb null                -- the check output that proved it
  notes             text null
  created_at, updated_at
  UNIQUE (vendor_id, item_key)
```

**Platform-scoped, like `vendor_subscriptions`** — no RLS, app-layer scoping by
`vendorId`, reachable only by `platform_admin`.

**`template_version` is not decoration.** Editing the runbook must not rewrite
the history of an in-flight onboarding. Items are seeded from a versioned
template at provisioning; a template change applies to new agencies only, and the
console shows which version an agency is running.

**`evidence` is what makes it auditable a year later.** Not "someone ticked TLS"
but the actual check result and its timestamp.

## 5. The template

Weights are estimated operator hours, and total 22 — the realistic figure for a
40-unit migrating agency derived in `LOCARE_PRICING_DECISIONS.md`.

| Stage | Name | Weight | Verifiable items |
|---|---|---:|---|
| 0 | Intake | 2.5 | — (all attestation) |
| 1 | Provision the tenant | 0.5 | vendor active, owner membership, tier, price set |
| 2 | Domain and hosts | 1.0 | six hosts resolve, TLS valid, CORS origin present |
| 3 | Brand | 2.0 | branding resolves on all four surfaces |
| 4 | People | 2.5 | each staff member has logged in at least once |
| 5 | Data migration | 7.0 | counts match intake, ledger nets to zero |
| 6 | Money path | 2.0 | collection method configured, mandate/reference present |
| 7 | Dry run | 1.5 | test invoice posts and balances |
| 8 | First rent run | 2.0 | run completed, one payment reconciled |
| 9 | Handover | 1.0 | — (all attestation) |

Stages 0 and 9 are entirely human. That is correct and should be visible: the
first and last stages of an onboarding are conversations, not queries.

## 6. Verification checks (R-9)

Each verifiable item exposes `POST /admin/onboarding/:vendorId/items/:key/check`,
returning `{ ok, detail, evidence }`. Checks are **read-only and idempotent** —
running one must never change agency state.

| Check | How |
|---|---|
| Hosts + TLS | Resolve and TLS-handshake each of the six hosts; report per host |
| Branding | `public_branding` for the slug; return the resolved logo and colours for visual confirmation |
| CORS | Assert the app origin is in the allow-list |
| Staff logins | `users.last_login_at` per membership |
| Data counts | Imported units vs the count captured at intake 0.4 |
| Ledger balance | Sum of the double-entry ledger for the vendor = 0 |
| Money path | Collection method set; DebiCheck mandate or EFT reference present |
| Rent run | A completed run exists for the period, with at least one settled payment |

A failed check sets `status = 'failed'` and stores the reason. **Failed is a
distinct state from pending** — "we tried and it is broken" is different
information from "nobody has looked yet", and conflating them is how a broken
host stays invisible.

## 7. Progress semantics

```
progress = Σ weight_hours(done | skipped) / Σ weight_hours(all)
```

Displayed alongside two things the percentage cannot say:

- **`Stage 5 of 9 · about 9 hours of work left`** — remaining weight, in hours.
- **Waiting on: the agency / us / their DNS provider** — derived from the
  `waiting_on` of the earliest incomplete item.

`skipped` counts as complete. An agency with no data to migrate has genuinely
finished stage 5, and a bar that punishes them for it is wrong.

**The portfolio view matters more than any single bar.** `/admin/onboarding`
lists every in-flight agency sorted by *days stalled*, with who each is waiting
on. That is the screen that answers "what is not moving", which is the question
the requirements doc says is currently unanswerable.

## 8. API surface

All under `@Roles('platform_admin')`, mirroring `admin-partners.controller.ts`.

```
GET   /admin/onboarding                        portfolio: agency, stage, %, waiting_on, days_stalled
GET   /admin/onboarding/:vendorId              full checklist, grouped by stage
POST  /admin/onboarding/:vendorId/seed         create items from the current template (idempotent)
PATCH /admin/onboarding/:vendorId/items/:key   status, waiting_on, owner, notes
POST  /admin/onboarding/:vendorId/items/:key/check   run the verification
```

Seeding is called automatically at provisioning and is safe to re-run — an
agency onboarded before this shipped (Dantalan) gets a checklist on first open,
with everything already true marked done by its own check.

## 9. UI

**Route:** `web-admin/app/admin/onboarding/` (portfolio) and `[vendorId]/`
(detail). Platform host only — `isPlatformHost()` — so it always renders in
`LOCARE_BRAND`, never an agency's theme.

**Components already in `components/ui.tsx`:** `Progress` for the bar,
`BentoTile` for the stage summary, `GlassCard` per stage, `Badge` for status,
`Modal` for attestation. Nothing new needs designing.

**Detail screen, top to bottom:**

1. Header — agency name, slug, template version, `Progress`, "Stage 5 of 9 ·
   about 9 hours left", waiting-on chip.
2. Stages as collapsible cards. **The current stage is open; the rest are
   collapsed.** This is most of the idiot-proofing — the operator sees one thing
   to do, not fifty-two.
3. Each item: title, status badge, owner, and either a **Run check** button
   (verifiable) or a **Mark done** button that opens a modal requiring a name
   (attestation).
4. Failed checks render the reason inline, in `danger`, with the check output.
5. Stages ahead of the current one are marked, **not locked**. Opening one says
   why the order matters and then gets out of the way. Locking was tried and
   removed: onboardings stall on third parties constantly, and a console that
   refuses to let a Reseller do anything else while a DNS controller ignores
   them is a console they stop opening.

**Two rules that carry most of the usability:**

- **Never more than one obvious next action on screen.** The current stage opens
  by default and everything else is collapsed — an affordance, not a restriction.
- **Every blocked state says who unblocks it and how.** Not "blocked" but
  *"waiting on the agency's DNS controller — records sent 4 days ago"*, with a
  resend button.

## 10. Build order

**Phase 1 — the tracker. BUILT 2026-09-10.** Table, template, seed, portfolio and
detail screens, manual status changes. No checks. Seeding is on-demand from the
agency's onboarding page rather than automatic at provisioning, because there is
still no UI path that creates an agency (R-3); wire it into `provision_agency()`
when that lands.

**Phase 2 — the checks**, most escalation-generating first: hosts/TLS, branding,
ledger balance. Each is independently shippable.

**Phase 3 — auto-advance.** Wire existing events (first unit, first settled rent
run) to complete their items.

**Phase 4 — the agency view.** A tokenised link, in the shape of
`partner-applications`, exposing only that agency's items for stages 0–4. Stage 5
onward stays behind a login because it touches tenants' personal information.

## 11. Testing

The console cannot be tested against Dantalan alone — a completed onboarding
exercises none of the mid-flight states. Two demo agencies exist for this,
seeded by SQL in `deploy/`:

| Agency | Units | State it produces |
|---|---:|---|
| Northcliff Letting (demo) | 48 | Stage 2, **stalled 9 days on a third party** — the case the portfolio view exists for |
| Sea Point Rentals (demo) | 210 | Stage 5, one item in progress, one waiting on the agency, one **failed** |

```
psql -f deploy/seed-demo-agencies.sql          # vendors, owners, subscriptions
# press "Start onboarding" on both in the console
psql -f deploy/seed-demo-onboarding-state.sql  # the mid-flight states
psql -f deploy/remove-demo-agencies.sql        # teardown
```

Two safeguards worth knowing about, because they are what make it safe to run
this against production:

- **Subscriptions are `trialing`, never `active`.** `generate()` selects on
  `status = 'active'`, so a demo agency cannot be invoiced however its unit count
  or `mrr` moves.
- **Owner emails use the `.invalid` TLD** (RFC 2606), which cannot resolve — if
  anything ever tries to mail them it fails at DNS rather than reaching a person.

The state file contains item KEYS only, never item definitions: the 43 items are
seeded from the live template by the console's own button, so the fixtures cannot
drift from the runbook.

## 12. What this measures, and why it pays twice

Recording actual hours per stage produces the number that settles the pricing
question. `MIN_BILLABLE_UNITS` is 30 because onboarding costs about R13,200, and
`LOCARE_PRICING_DECISIONS.md` says explicitly that the minimum should fall when
that does. Without this, whether it has fallen is a guess. With it, the minimum
comes down on evidence — which opens the 20–30 unit band currently turned away.

## 13. Open questions

- Does the operator ever need to *reopen* a completed stage, and does that
  invalidate downstream items?
- Should a stalled onboarding notify anyone, or is the portfolio view enough?
- Do Resellers get the console at all, or only their own agencies within it?
