# Locare — what onboarding needs before it can be handed over

Written 2026-09-05. Owner: Arthur. Companion to
`LOCARE_AGENCY_ONBOARDING_RUNBOOK.md`, which is the procedure as it stands
today. This document is what has to change for someone other than Arthur to run
that procedure end to end.

---

## The test this document is written against

> **A competent operator with a browser, a back-office login and the runbook —
> and no SSH access to the VPS, no database client, and no ability to deploy —
> takes an agency from signed to first correct rent run.**

Today the answer is **no**, and it fails in four specific places. Everything
below is ordered by how much it blocks that sentence.

This matters commercially, not just operationally. The audit-season play's own
conclusion is that the constraint on growth is not leads — it is that onboarding
an agency is a real week of work for one person, and that selling faster than
you can onboard is how you acquire a reputation you cannot outrun. The partner
programme is the thing that scales, and a Reseller earning 26% is being paid
precisely to do this work. A Reseller who cannot complete an onboarding without
Arthur's SSH session is not a channel; they are a queue.

---

## Blocking gaps

### R-1 · Bringing an agency's domain live requires SSH · **Blocker**

Every agency host needs a hand-written block in `deploy/Caddyfile` and a Caddy
container restart. There is no wildcard: `*.locare.co.za` is noted in the
Caddyfile as "comes later", and agency domains are custom anyway.

**Blocks:** Stage 2.2. The single largest handover blocker — nothing an agency
sees exists until it is done.

**Options:**

- **On-demand TLS with an allowlist endpoint.** Caddy asks the API "may I issue
  a certificate for this host?" and the API answers from `vendors.custom_domain`.
  New agency domains then work with no config change and no restart. This is the
  correct answer and it is a well-trodden Caddy pattern.
- Wildcard certificate for `*.locare.co.za` via DNS-01, which fixes
  Locare-subdomain tenants only and not custom domains. Useful as a fallback
  offer ("start on `youragency.locare.co.za` today, move to your domain later"),
  not as the fix.

**Acceptance:** an operator sets a domain in the UI; within one propagation
window all six hosts serve valid TLS, with no VPS access and no restart.

---

### R-2 · Operator access is an environment variable · **Blocker**

Platform-admin rights come only from `PLATFORM_ADMIN_EMAILS`, never from the
database. Granting an operator admin access therefore requires editing
`.env.prod` and recreating the API container — so Arthur must deploy in order to
let someone else work.

**Blocks:** Stage 4.2, and every stage that needs Admin.

**What to build:** platform-admin as a database role with an audited grant and
revoke, keeping the env var as an emergency bootstrap for the first admin only.
Revocation matters as much as granting: today, removing an operator's access is
also a deploy.

**Acceptance:** an existing admin grants and revokes operator access in the UI;
the change is audited and takes effect at the operator's next sign-in.

---

### R-3 · A direct-sold agency cannot be created in the UI · **Blocker**

`/admin/agencies` lists and impersonates, nothing more. Agency creation exists
only via a partner's referral link or a partner's portal. An agency Arthur sells
directly must be created by calling `provision_agency()` in SQL on the VPS.

**Blocks:** Stage 1.1 for exactly the customers the audit-season play is aimed
at — every one of which is direct-sold.

**What to build:** Admin → Agencies → **New agency**, calling the same
`provision_agency()` path with a null partner, and setting the tier at creation
rather than defaulting to `starter`.

**Acceptance:** an operator creates a direct agency, on the right tier, in the
UI, with no partner attribution recorded.

---

### R-4 · `custom_domain` has no UI · **Blocker (small)**

The column exists and public branding and the rentals site resolve by it, but
nothing writes it except SQL.

**What to build:** a field on the agency's admin page, validated (a bare domain,
not a URL), ideally checking the A record resolves to the VPS before saving —
which would also catch the most common DNS mistake at the moment it is made.

**Acceptance:** operator sets it in the UI; branding resolves on the new host
without a deploy. Naturally pairs with R-1.

---

### R-5 · There is no data import · **Blocker for the effort target, not for correctness**

No CSV or bulk endpoint exists for owners, properties, units, tenants or leases.
Stage 5 is entirely manual entry, and it is the bulk of the week.

Worse than slow, it is **silently wrong**: a mistyped escalation date surfaces in
month four as a credibility problem, and the correction is a reversing ledger
entry rather than an edit.

**What to build, in order of value:**

1. A **CSV template** per entity, in dependency order, with the exact columns
   and an example row. Cheap, immediate, and useful even with no importer.
2. A **validating importer** — upload, dry-run, show what would be created and
   what is wrong, then commit. The dry run is the point: it turns silent errors
   into a list someone can check before anything is posted.
3. An **opening-balance import** with the arrears list printed for the
   principal's sign-off before posting.

**Acceptance:** a 60-unit agency's data is loaded and verified in under an hour,
with a dry-run report the principal signs.

---

## Non-blocking, but they make handover safe

### R-6 · CORS origins live in the environment

Adding an agency's origins needs an env edit plus `--force-recreate`. Even with
R-1 solved, a new domain would be served by Caddy and then blocked by the
browser. **Resolve allowed origins from `vendors.custom_domain` at request time**
so the two never drift. Small change; large consequence, because the failure
looks like a broken app while the logs stay clean.

### R-7 · Nothing tracks where an agency is in onboarding

There is no record of which stage an agency has reached, so a handover between
two people is a conversation, and a stalled onboarding is invisible. A stored
checklist per agency — the Definition of Done from the runbook, with who
completed each item and when — turns onboarding into something a second person
can pick up and Arthur can audit without asking.

### R-8 · Tier is hardcoded at provisioning

`provision_agency()` always writes `starter`. If the correction is forgotten,
the agency is under-billed and the partner's commission is wrong. Set the tier at
creation (R-3) and warn when active leases exceed the tier's band.

### R-9 · A per-agency preflight

`deploy/money-path-preflight.sh` proves the platform is healthy. The equivalent
for one agency — six hosts resolving with valid TLS, branding resolving, API
reachable from the app origin, one test invoice posting and balancing — would
let an operator prove a stage is done rather than believe it. This is the
cheapest item here and it removes most "is it just me?" escalations.

### R-10 · The Reseller Support Addendum does not exist

Curriculum Module 7.6 promises first-line support governed by an addendum that
has not been written. Until it exists, a Reseller has no defined scope, no
response times, and no escalation path — and the runbook can only tell them not
to promise anything. **Do not sign a Reseller before this is written.** It is
drafting work, not engineering work, and it should be based on observed support
volume from the first two or three onboardings rather than invented numbers.

### R-11 · POPIA position when someone else does the migration

At Stage 5 an operator handles the agency's tenants' personal information. Where
that operator is a third-party Reseller, the agency is the responsible party,
Locare is an operator, and the Reseller is a further operator — which needs an
operator agreement in writing and a rule that data never leaves Locare into
personal spreadsheets. Worth the same ten minutes with the attorney already
being briefed on the trust-account question.

---

## What "streamlined" should mean, measurably

Not "faster" in the abstract. Three numbers, measured on the next three
onboardings and recorded in the checklist from R-7:

| Measure | Today | Target |
|---|---|---|
| **Operator hours** per agency (60 units, migrating) | A week, one person | Under 8 hours |
| **SSH-gated steps** in the runbook | 4 | **0** |
| **Elapsed** signed → first correct rent run | Unmeasured | Under 14 days, DNS excepted |

The middle row is the one that decides whether this is a channel or a queue.

---

## Suggested sequence

**First — free the operator (R-1, R-2, R-3, R-4, R-6).** Together these remove
every SSH-gated step. They are what turn the runbook from something Arthur
executes into something Arthur delegates. R-1 is the biggest single piece;
R-3, R-4 and R-6 are small once it lands.

**Second — cut the week (R-5).** Start with the CSV templates, which cost almost
nothing and help immediately, then the dry-run importer. This is the largest
build in the list and it should be shaped by doing one more onboarding by hand
first, so the importer matches real source data rather than an imagined format.

**Third — make it observable and safe (R-7, R-9, R-8).** Checklist, per-agency
preflight, tier warnings. Cheap, and they are what let a second person take over
mid-onboarding.

**Alongside, not after — the paperwork (R-10, R-11).** These gate signing a
Reseller at all, and they are not engineering work, so they can run in parallel
with the build rather than queue behind it.

**Do not** build R-5's importer before R-1. An operator who can migrate data in
an hour but still cannot bring a domain live has been handed the easy half of
the job.
