# Locare on-site demo — build plan

Written 2026-10-08. Owner: Vernon. Prospect: **Midnight Masquerade** (500 units,
Cape Town). Read with `LOCARE_ONSITE_CLIENT_OPTIONS.md` (the options note taken
to them on 2026-10-06).

The goal is a **working demo of the three on-site options**, A, B and C, bootable
on one machine and switchable between modes, seeded with the Midnight Masquerade
profile. Not slides: the thing itself, with tenant self-service visibly present
in B and C and visibly absent in A.

One scheduled run per morning does **one day** of this plan and stops. Days are
sized to be finishable in a single run without exploring the repo.

## How a run works

1. Read this file. Find the **first day whose box is unticked**. That is today's
   scope, whatever the date is.
2. Read only the files that day lists. Do not grep or search the repo.
3. Do the work. Typecheck the side you touched (`npx tsc --noEmit` at the repo
   root for the API, in `web-admin/` for the front end). Do not run the stack,
   install packages, or build images unless the day says so.
4. Tick the box, append one line to the log at the bottom, and stop.
5. **Do not commit, push or deploy.** Vernon runs git himself. End by printing
   the `git add` / `git commit` line for the day's files.

If every box is ticked, do nothing and say the plan is complete.

---

## What already exists

Committed in `66b6584`, and not to be rebuilt by a run:

- `deploy/demo/compose.demo.yml` — a complete second product instance: own
  Postgres, own Redis, own media volume, Mailpit as the only mail path, no
  payment or payout provider, its own JWT and PII keys. Datastores are named
  `demo-postgres` / `demo-redis` and are deliberately off the production
  network. **Read the warning at the top of that file before editing it.**
- `deploy/demo/.env.demo.example` — the secrets and the price ladder.
- `deploy/Caddyfile` — the demo hosts.
- `demo/profiles/midnight-masquerade.json` — the prospect profile: agency,
  branding, a 500-unit Cape Town portfolio across ten named buildings, staff and
  two app logins, a named story set (two arrears, two maintenance jobs, a lease
  expiring, a lease awaiting signature), and twelve months of history. Every
  date is an offset from the run, never a literal.

What is missing is everything below: the seeder that turns a profile into an
agency, and any notion of the three modes.

## What each mode has to show

| | Data sits | Run by | Tenant & landlord | Their IT |
|---|---|---|---|---|
| **A** On-Site, Back Office | their building, sealed | their IT | none — statement import, print and sign | low |
| **B** On-Site, Connected | their building, one published address | their IT | all | high |
| **C** Private Server | our data centre, own database | us | all | none |

C is close to what the demo stack already is. B is C's feature set with a
different topology story. **A is the only one that needs real product work**: the
tenant and landlord surfaces have to be genuinely off, not hidden, and rent and
signature have to work without the internet.

## Standing constraints

- **One flag decides a mode**: `DEPLOYMENT_PROFILE` ∈
  `onsite_backoffice` | `onsite_connected` | `private_server`. No second switch,
  no per-feature env var for the demo to get out of step with.
- **A is a real gate, not a hidden menu.** In `onsite_backoffice` the tenant and
  landlord entry points are refused server-side. A demo that only hides the
  button is the demo that loses the room when someone asks.
- **No new tables and no migration for the mode layer.** The flag is
  configuration. The seeder may write data, which is what seeders do.
- **Nothing in the demo can reach a real person or a real rail.** Mailpit only,
  no payment provider, no payout provider — as the compose file already has it.
  A run must not add a provider key to make something work.
- **Tenant isolation and the ledger are untouched.** Per `CLAUDE.md`: RLS on
  `app.current_vendor_id`, double-entry postings, corrections as new postings.
  The demo is not a reason to bypass either.
- The seeder reads a profile and invents nothing outside it. Figures a run
  cannot source from the profile or the platform's own maths do not go on screen.

## Assumptions, to be corrected after the call

The options note ends with seven questions and none are answered yet. The demo is
built for the **hardest reading** so that every answer can only make it easier:

1. **Why on-site** — assumed policy, not preference. So A has to be genuinely
   sealed, and C is offered as the thing they may actually mean.
2. **Tenant and landlord logins** — assumed *not* required. A is therefore the
   default mode the demo opens in, with B shown as the upgrade.
3. **How rent is paid today** — assumed manual EFT already. A's rent story is
   bank-statement import, and it is presented as no loss rather than a gap.
4. **Who their IT is** — assumed an outsourced provider, not a department. So B's
   published-address work is shown honestly as real effort.
5. **Is there a server** — assumed none, must be bought. The 4-core / 16 GB /
   500 GB / Linux / always-on spec stays on screen in the A and B modes.
6. **Users, properties, leases** — taken from the profile: 500 units, three
   staff. The only true things in it are the agency name and the portfolio size.
7. **Who signs and by when** — unknown, and nothing in the build depends on it.

Every one of these is an assumption, not a finding. A run must not quietly
upgrade one into a fact.

---

## Day 1 — Prospect seeder

Read: `demo/profiles/midnight-masquerade.json`, `scripts/seed.ts`,
`scripts/seed-demo-partner.ts`.

Create `scripts/seed-prospect.ts` (`npm run seed:prospect -- <slug>`): reads
`demo/profiles/<slug>.json` and builds the whole agency — vendor, branding,
subscription at the profile's tier, buildings and units to hit `targetUnits`
exactly, leases at the profile's occupancy, staff and the two app logins.

Dates are offsets from the run, as the profile says. Idempotent on the slug: a
second run replaces rather than doubles. Login is passwordless OTP, so set no
password.

History and the story set are Day 2 — today is the structure.

- [ ] Done

## Day 2 — Seed the history and the story

Read: `scripts/seed-prospect.ts`, `demo/profiles/midnight-masquerade.json`.

Twelve months of invoices and payments at `rentDueDayOfMonth`, through the
ledger rather than written straight to tables — a demo whose statements do not
reconcile is worse than no demo.

Then the story set, which is what gets clicked on screen: both arrears at their
stated days late and amounts, both maintenance jobs, the lease expiring in 54
days, and the lease awaiting signature. These have to survive a click, not just
a scroll.

- [ ] Done

## Day 3 — The deployment profile, API side

Read: `src/providers/` (the index or module that wires providers),
`src/common/config/` (whichever file reads env), `deploy/demo/.env.demo.example`.

Add `DEPLOYMENT_PROFILE` and one resolver exposing the three modes plus the
capability questions the rest of the code asks: are tenant logins served, are
landlord logins served, are public listings served, is card / instant-EFT rent
available, is e-signature available, can OTP go to a phone.

`private_server` is the default, so an unset flag behaves exactly as the stack
does today. A Jest spec in `test/` covers the resolver and every capability in
all three modes.

- [ ] Done

## Day 4 — Enforce mode A server-side

Read: the resolver from Day 3, the auth module's tenant and landlord entry
points, the public listings controller.

In `onsite_backoffice` the tenant and landlord login routes and the public
listings routes refuse — a plain, correct refusal naming the deployment mode, not
a 404 and not a crash. Staff auth is untouched in every mode.

A spec in `test/` proves the refusal in A and the normal path in B and C. This is
the day the demo stops being a story about a hidden button.

- [ ] Done

## Day 5 — Rent and signature without the internet

Read: `src/providers/payment/`, `src/providers/esign/`, the resolver.

Two mode-A paths, both as providers behind the existing interfaces so nothing
upstream changes shape:

- **Bank-statement import** as the rent path: a file in, matched against open
  invoices, postings through the ledger. Unmatched lines are listed for a human,
  never guessed.
- **Print-and-sign** as the signature path: the lease renders to a signable
  document with a signature block, and the countersigned scan uploads back
  against the lease.

Specs for the matcher in `test/`. The unmatched case is the one that matters.

- [ ] Done

## Day 6 — Honour the mode in the back office

Read: `web-admin/lib/` (the config or brand helper that reads server-side env),
`web-admin/components/shell.tsx`, the resolver's capability names.

The back office reflects the live mode: surfaces that mode A does not serve are
absent from the nav, and the rent and signature actions offer the Day 5 paths
instead of card and e-sign. Nothing renders a control that the API will refuse.

Unbranded wording, colour from `--brand`, per the platform's white-label rule.

- [ ] Done

## Day 7 — The mode switch and the demo console

Read: `deploy/demo/compose.demo.yml`, `deploy/demo/.env.demo.example`,
`deploy/Caddyfile`.

One command brings the stack up in a named mode, and switching modes does not
reseed. Add a demo console page, reachable only in the demo stack, that states
the live mode, what it serves and what it does not, which hosts exist in it, and
— for A and B — the four things the client must supply: the server spec, a way to
send email, off-machine nightly backups with one tested restore, and a named IT
person.

This is the page that is on screen while the trade-off is explained, so it
carries no figure the options note does not.

- [ ] Done

## Day 8 — Run the three modes end to end

Read: this file, `LOCARE_ONSITE_CLIENT_OPTIONS.md`.

Boot each mode and walk it: staff back office in all three; tenant and landlord
login refused in A and working in B and C; statement import and print-and-sign in
A; the story set clickable in every mode.

Then the honest part. Write `docs/LOCARE_ONSITE_DEMO_SCRIPT.md`: the running
order, which mode to open in, where the room is expected to ask the question that
the switch answers, and the seven questions to come back with. Report anything
that drifted from this plan rather than fixing it silently.

- [ ] Done

---

## Open items

- (a) All seven client questions are unanswered. The assumptions above stand in
  for them and are marked as assumptions wherever they reach the screen.
- (b) Branding is Locare's own palette — `demo/profiles/midnight-masquerade.json`
  carries `brand`/`tint`/`accent` placeholders and a null logo. Their real logo
  and colours need to land before the demo is shown.
- (c) `CUSTOM_UNIT_RATE` is unset in `.env.demo.example`. At 500 units the
  profile is past `GROWTH_MAX_UNITS` by the platform's own maths, so the tier is
  a Custom conversation and the demo shows no rate until Vernon sets one.

## Log

One line per run: date, day number, what landed, anything left.

