# Locare — what onboarding needs before it can be handed over

Written 2026-09-05. Owner: Vernon. Companion to
`LOCARE_AGENCY_ONBOARDING_RUNBOOK.md`, which is the procedure as it stands
today. This document is what has to change for someone other than Vernon to run
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
Vernon's SSH session is not a channel; they are a queue.

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

### R-2 · Operator access is an environment variable · **DONE** (Sep 2026)

Was: platform-admin rights came only from `PLATFORM_ADMIN_EMAILS`, so granting
an operator access meant editing `.env.prod` and recreating the API container.
So did taking it away.

**Built:** Admin → Operators. Grants live in `platform_admins` (migration
`1720000052000`) and are append-only — a revoke stamps `revoked_at` rather than
deleting the row, because "who could do this, and when" is a question only ever
asked after something has gone wrong, and a deleted row is no answer. Every
grant carries who granted it, when, and a required reason.

`PLATFORM_ADMIN_EMAILS` survives as a **bootstrap**: it is how the first admin
exists on a fresh database and how you get back in if the last grant is removed
by accident. It is checked in addition to the table, never instead of it, and
the UI lists those addresses separately as un-revocable, because a button that
cannot work is worse than an explanation.

**Revocation is immediate, not next-sign-in.** The original acceptance criterion
said "takes effect at the operator's next sign-in", which would have left a
revoked operator holding admin rights for the length of their idle window — the
precise failure this gap existed to close. `SessionStore` now keeps a reverse
index of every session id per user, and a revoke deletes all of them, so access
ends on their next request, on every device.

Two guards, enforced both in the pure rules module (so the UI can explain them)
and inside `platform_admin_revoke()` under a row lock (so a race cannot get past
both): you cannot revoke yourself — this is the screen you would need to undo it
— and you cannot remove the last active grant.

**One footgun surfaced and closed.** `issueForUser()` resolves a sign-in context
in priority order — platform admin, then partner, then vendor membership — and
returns at the first match with `vendorId: null`. So granting operator access to
someone who already uses Locare as a tenant, an agency owner or a partner
silently takes that access away. That predates R-2, but the Operators screen
makes it easy to hit: the obvious person to grant access to is an agency owner
helping with an onboarding. The grant form now checks the address as it is typed
and names exactly what would be replaced, requiring an explicit acknowledgement;
the API refuses the same grant without `acknowledge`, because a UI-only warning
is the same bug one layer down.

The real fix is account switching — one person, several contexts, chosen at
sign-in. That is its own piece of work and is not scheduled.

**Acceptance met, and exceeded on timing:** an existing admin grants and revokes
operator access in the UI; the change is audited and takes effect immediately.

---

### R-3 · A direct-sold agency cannot be created in the UI · **DONE** (Sep 2026)

Was: `/admin/agencies` listed and impersonated, nothing more. Creation existed
only via a partner's referral link or a partner's portal, so a direct sale meant
calling `provision_agency()` in SQL on the VPS.

**Built:** Admin → Agencies → **New agency**, writing through
`platform_create_agency()` (SECURITY DEFINER, migration `1720000051000`) — a
sibling of `provision_agency()` that takes no partner, writes no deal or
activity row, and takes the tier and price from the caller rather than
defaulting to `starter`. The slug uniqueness check is inside the function, so
two operators racing cannot both win, and the error names the agency already
holding the address.

**The form asks for units, not a tier.** The operator knows the portfolio size;
which band it falls in is arithmetic the pricing engine already owns. Tier and
MRR are derived and shown live as they type, with a manual tier available for
odd cases and recorded as an override when it disagrees with the units.

**Below 30 units it will not save** without a price, a reason and an end date.
The billing guard (§ pricing decisions) refuses these portfolios anyway; the
difference is that it refuses them weeks later, at invoice time, in front of
whoever runs billing rather than whoever made the sale. Open-ended discounts are
refused outright — that is how a floor stops being a floor.

Creation also seeds the 43-item onboarding checklist, so an agency that exists
is an agency visible in the console. It deliberately sends the owner nothing.

**Acceptance met:** an operator creates a direct agency, on the right tier, in
the UI, with no partner attribution recorded.

---

### R-4 · `custom_domain` has no UI · **DONE** (Sep 2026)

Was: the column existed and public branding and the rentals site resolved by it,
but nothing wrote it except SQL.

**Built:** a **Custom domain** panel at the top of the agency's onboarding page.
It normalises whatever is pasted — scheme, `www.`/`app.` label, port, path,
trailing dot, case — down to the bare registrable domain, and refuses a public
suffix (`co.za`), a Locare-owned domain, and a domain already claimed by another
active agency, naming the holder. Saving clears the host cache so the new domain
is served on the next request rather than after the ten-second deny TTL.

Writes go through `platform_set_custom_domain()` (SECURITY DEFINER, migration
`1720000050000`), because the back office has no tenant context and `vendors` is
under RLS. The uniqueness check is in the function, not the UI, so two operators
racing cannot both win.

The pre-save A-record check is deliberately **not** built: on-demand TLS (R-1)
already refuses to issue for a domain that does not resolve here, and the
`tls-check` probe in runbook 2.3 diagnoses it in one command. Adding a DNS
lookup to the save path would make it fail while propagation is still in flight,
which is the normal case.

**Acceptance met:** operator sets it in the UI; branding resolves on the new host
without a deploy.

---

### R-5 · There is no data import · **Mostly done** (Sep 2026)

Was: no CSV or bulk endpoint for owners, properties, units, tenants or leases,
so stage 5 was entirely manual entry and the bulk of the week.

**Built:** templates, upload, column mapping, dry run, and — as of 16 Sep — the
commit, for the five reversible entities. See `LOCARE_DATA_IMPORT_DESIGN.md`.

**Still outstanding: deposits and opening balances** (phase 3). These post to
the append-only ledger, so they need the arrears schedule printed and signed by
the principal before anything is posted. The commit path refuses them explicitly
rather than falling through, so there is no way to post money by accident — but
stage 5 is not finished until this lands, and it is the half that carries the
real risk.

The original text follows, for the record.

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
can pick up and Vernon can audit without asking.

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

### R-12 · One person, one context — no account switching

`issueForUser()` resolves a single sign-in context in priority order — platform
admin, then partner, then vendor membership — and returns at the first match.
A person is therefore exactly one thing, and a higher-priority role silently
displaces a lower one. Granting platform-admin to an agency owner takes their
agency away; adding someone to a partner takes their tenancy away, today with no
warning at all.

R-2 closed the loudest case: the Operators screen names what a grant would
replace and requires an acknowledgement. The partner path has no such warning,
and nothing anywhere offers the person a way back.

**Why it will matter.** The plausible dual-role profile is an agency principal
who also introduces deals — precisely the Introducer the partner programme is
aimed at. The first time one signs up, their own agency login stops working, and
the failure looks like a bug rather than a policy.

**What to build:** memberships resolved as a list rather than a winner, a
context picker at sign-in when there is more than one, and the active context
carried in the session token. Not small, and not urgent while there is one live
agency and no dual-role partner — but it should be decided before the partner
programme recruits, not after.

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
every SSH-gated step. They are what turn the runbook from something Vernon
executes into something Vernon delegates. R-1 is the biggest single piece;
R-3, R-4 and R-6 are small once it lands.

*Status: R-1, R-2, R-3 and R-4 are done — on-demand TLS, operator access,
direct agency creation and the domain panel. Every SSH-gated step in this group
is closed; R-6 remains.*

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
