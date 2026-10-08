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

- [x] Done

## Day 2 — Seed the history and the story

Read: `scripts/seed-prospect.ts`, `demo/profiles/midnight-masquerade.json`.

Twelve months of invoices and payments at `rentDueDayOfMonth`, through the
ledger rather than written straight to tables — a demo whose statements do not
reconcile is worse than no demo.

Then the story set, which is what gets clicked on screen: both arrears at their
stated days late and amounts, both maintenance jobs, the lease expiring in 54
days, and the lease awaiting signature. These have to survive a click, not just
a scroll.

- [x] Done

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

- [x] Done

## Day 4 — Enforce mode A server-side

Read: the resolver from Day 3, the auth module's tenant and landlord entry
points, the public listings controller.

In `onsite_backoffice` the tenant and landlord login routes and the public
listings routes refuse — a plain, correct refusal naming the deployment mode, not
a 404 and not a crash. Staff auth is untouched in every mode.

A spec in `test/` proves the refusal in A and the normal path in B and C. This is
the day the demo stops being a story about a hidden button.

- [x] Done

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

- [x] Done

## Day 6 — Honour the mode in the back office

Read: `web-admin/lib/` (the config or brand helper that reads server-side env),
`web-admin/components/shell.tsx`, the resolver's capability names.

The back office reflects the live mode: surfaces that mode A does not serve are
absent from the nav, and the rent and signature actions offer the Day 5 paths
instead of card and e-sign. Nothing renders a control that the API will refuse.

Unbranded wording, colour from `--brand`, per the platform's white-label rule.

- [x] Done

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

- [x] Done

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
- (e) `partner` and `platform_admin` are ungated in every mode. They are
  Locare's own roles, not the agency's outsiders, and on a sealed box nobody
  holds those accounts — but nobody has said so out loud.
- (c) `CUSTOM_UNIT_RATE` is unset in `.env.demo.example`. At 500 units the
  profile is past `GROWTH_MAX_UNITS` by the platform's own maths, so the tier is
  a Custom conversation and the demo shows no rate until Vernon sets one.

## Log

One line per run: date, day number, what landed, anything left.
2026-10-08 — Day 1. `scripts/seed-prospect.ts` (`npm run seed:prospect -- <slug>`): reads `demo/profiles/<slug>.json` and builds the agency — vendor with branding into `vendors.config->'branding'`, `vendor_subscriptions` at the profile's tier, ten buildings, 500 units, 470 leases at the profile's 0.94 occupancy, three staff, the landlord owner account linked to Venetian Mews and Volto Street Houses, and the tenant demo account on Masquerade Heights 304. Idempotent on the vendor slug; rents, names and lease start dates come from a PRNG seeded on the slug, so a re-run rebuilds the same world. Two conversions the profile forces and both are documented in the file header: the profile is in **cents** and every money column here is in **rands** (`toRands()`), and the profile's building vocabulary (`apartment_block`, `semi_detached`, `house`) is not `PropertyType` — mapped to building/complex with the profile's own word kept in `properties.attributes.profileType`. Units the profile names by label are **reserved before** the generated fillers, because the floor scheme (8 per floor) would never produce `The Carnival 212` or `Harlequin Court 7B`; the seeder also asserts the slot count equals `targetUnits` rather than silently seeding 499. Day 1 does create the story units' named tenants, since a lease needs a tenant and inventing a filler for a unit whose tenant the profile names would only have to be undone on Day 2. `mrr` stays 0 while `unitRateCents` is null — open item (c), no rate invented. Verified without a database: the file typechecks in isolation (the full root typecheck exceeds this environment's 180s shell limit, and backgrounding does not survive between calls — worth a narrower tsconfig for the API side), and a simulation of the generator against the real profile gives 500 slots for a 500 target, 500 unique labels, 470/30 occupancy and all seven named labels present. Ran clean against the live database on 2026-10-08: vendor 85864c53-28dd-45b2-97ea-156bdaca949d, 500 units created, 470 leases, 470 occupied — matching the dry simulation exactly, so the INSERTs do match the live schema. (The failure before that was environmental, not the seeder: `hms-postgres` from another project held 0.0.0.0:5433 while `pms03-postgres-1` had been exited for eight days, so the connection succeeded against the wrong database and failed auth. Two projects both claim 5433 — worth remapping one permanently.) A second run confirmed idempotency: same vendor, 0 units and 0 leases created, counts unchanged. Left: generated tenant emails are `tenant###@midnight-masquerade.demo` (from the slug) while the staff addresses in the profile are `@midnightmasquerade.demo` (no hyphen) — harmless with Mailpit catching everything, but two domains in one demo is a detail worth collapsing on Day 2. Also moved a stray `tsconfig.prospectcheck.json` into `_to_delete/` (rm is not permitted in this session).
2026-10-08 — Day 2. History and story added to `scripts/seed-prospect.ts` (still one command). Twelve months of invoices plus the current month per active lease, each with a balanced double-entry transaction in the same shape the app's own services post: AR debit total / Rental Income credit rent / VAT Output credit tax for an invoice, Bank debit / AR credit for a payment, with the `lease:`, `payment:` and `invoice:` entityRefs and `ledger_txn_id` written back onto both documents. **Posted through the ledger's invariant, not its plumbing**: `assertBalanced` is imported from `src/modules/accounting/double-entry` and every transaction is checked before insert, because `LedgerService` and `InvoiceService` are request-scoped Nest providers that cannot be driven from a script — the file says so. VAT is recomputed as `za-vat.tax.ts` defines it (tax-exclusive rent, 15%), and the file warns that this must not drift from `buildRentInvoice`. Accounts are created per vendor on the STD_ACCOUNTS codes (1000/1100/2100/4000) if absent. Inserts are batched and chunked to 60k parameters — roughly 5.5k invoices, 5k payments and 28k ledger rows one at a time would be minutes of round trips. Idempotency: the history mints its own ids, so a re-run cannot match them; if any invoice exists for the vendor the whole phase is skipped and says so. Story set: both maintenance tickets, the lease expiring in 54 days (as an `end_date` on the existing lease, not a second lease), and the awaiting-signature lease as a `draft` lease plus a `sent` lease_agreement on the vacant unit, which goes to `reserved`. The two arrears leases have their rent set to `amount/1.15` so the profile's stated outstanding figure stays true AND the invoice reconciles to its own lines — adjusting the rent is the honest direction; a total that did not match its lines would put a broken invoice on screen. Verified statically: the file typechecks, and a simulation against the real `assertBalanced` balanced all 361 generated-rent invoice and payment transactions across the profile's range, with both arrears amounts (R11 800, R18 900) reconciling EXACTLY. **Drift to report, not fixed:** the profile's `daysLate` of 11 and 38 is not reachable with `rentDueDayOfMonth: 1` — rent falls due on the 1st, so the only possible ages today are 7, 37, 68… The seeder produces the nearest unpaid run (The Carnival 212 at 7 days; Harlequin Court 7B at 37 and 7), so the screen will show 7 and 37 rather than 11 and 38. Vernon's call: either accept the near-miss, or the profile moves `rentDueDayOfMonth` or restates `daysLate`. Ran clean against the database on 2026-10-08 and the back office was walked end to end. New finding from that walk, for Day 6: at 500 units the list pages render every row with no pagination, so the rent roll is a single enormous scroll — fine at Demo Agency's seven units, not fine in front of a prospect. Left: the tenant-email domain mismatch from Day 1 is unchanged — the awaiting-signature tenant also lands on `@midnight-masquerade.demo`.
2026-10-08 — Day 3. `src/common/config/deployment-profile.ts`: one `DEPLOYMENT_PROFILE` flag, the three modes, and a capability resolver answering the six questions the rest of the code is allowed to ask — tenant logins, landlord logins, public listings, online rent, e-signature, OTP to a phone. No per-feature env var, deliberately: a second switch is how a deployment ends up half-sealed with the portal off and the listings still answering. Unset resolves to `private_server`, so every existing deployment is unchanged. **An invalid value throws rather than falling back**, and `validate-env.ts` now calls the resolver so a misspelled profile refuses to boot — defaulting a typo to `private_server` would silently open tenant logins, landlord logins and public listings on an installation someone had configured to seal them, which is failing open on the one setting whose whole purpose is to close things. B and C carry identical capabilities, and the spec asserts that equality rather than hiding it: they differ in where the data sits and who runs the machine, not in what the product does, and inventing a feature difference would be inventing one the client would not find. `isOnSite()` marks A and B, for the four things the client must supply. `test/deployment-profile.spec.ts`, 11 cases, green. `deploy/demo/.env.demo.example` documents the flag. Nothing is enforced yet — the resolver exists and nothing calls it except the boot check; Day 4 is where mode A starts refusing.
2026-10-08 — Day 4. Mode A now refuses server-side. **Tenant and landlord sign-in is gated inside `AuthService.issueForUser`**, not at a controller: that method is the single point every sign-in path converges on — OTP, Google, and anything added later — so a check on the OTP endpoint alone would have left Google wide open. It refuses AFTER the code is verified rather than at `otp/request`, because refusing on request would tell anyone who can type an address whether it belongs to a tenant; by the refusal point they have proved control of the mailbox. The 403 carries `code: 'DEPLOYMENT_PROFILE_FORBIDS_ROLE'` and says plainly that the installation serves staff only — it does not pretend the account is missing, because the person is a real tenant on a system that does not serve tenants. Public listings are gated by a `CapabilityGuard` + `@RequiresCapability('publicListings')` decorator (`src/common/config/capability.guard.ts`) on the three unauthenticated routes. A 403 rather than a 404 on purpose: the client's question is whether it is actually off or merely off the menu, and a refusal naming the mode answers it. `isRoleServed` gates only `tenant` and `owner`, the two the client note names; `partner` and `platform_admin` are Locare's own roles rather than the agency's outsiders, and inventing a rule for them would be inventing policy — new open item (e). `test/deployment-enforcement.spec.ts`, 11 cases, green; `test/auth-refresh.spec.ts` still green, which matters because the gate sits in the method that mints every token. Typecheck clean, with one real error found and fixed on the way: `AuthService` has no `logger` field, so the warn line came out rather than a field going in. Left: unset `DEPLOYMENT_PROFILE` still means `private_server`, so nothing in any running deployment changes; and none of this has been exercised against a booted stack — setting the flag to `onsite_backoffice` and attempting a tenant login is the real test.
2026-10-08 — Day 5. The two mode-A paths, both behind the existing interfaces so nothing upstream changes shape. **Rent: `src/providers/payment/statement-import.ts`**, a pure matcher over statement lines and open invoices. Two passes, strongest evidence first — a reference is a statement of intent by the payer, an amount is a coincidence waiting to happen — reusing the existing `payerReference`/`beneficiaryReference` convention from `stitch-refs.ts` rather than inventing a second one, and normalising away whatever punctuation the bank inserts. The rule the file is built around: **match only what is certain and list the rest for a human**. Two invoices at the same amount gives `ambiguous_amount` with both candidate ids, never the nearer one — two tenants on the same rent is ordinary in a block of flats, so a confident wrong allocation is the likely failure, and it surfaces weeks later as a tenant wrongly chased. An invoice is claimed at most once per run; debits are `not_a_credit`; a partial payment does not match a full invoice. **Signature: `PrintSignEsignProvider`**, implementing `EsignProvider` so `lease-agreement` still creates a request, stores a ref and tracks sent/signed — only the middle differs. Its `signUrl` is an INTERNAL back-office print route, and it sends no mail, because a sealed installation has no outbound path and a provider that quietly tried one would be the exact failure the mode exists to prevent. `esign.module.ts` now binds on the deployment mode FIRST: a mode without e-signature gets print-and-sign even if `ESIGN_API_URL` is set, so a stale provider URL in a sealed box's env cannot reach the internet to sign a lease. `test/statement-import.spec.ts`, 13 cases, green; typecheck clean. Checked before building: `src/modules/imports` is onboarding migration (leases, opening balances, deposits), not recurring statement reconciliation, and `proof-of-payment` is tenant-submitted — so this duplicates neither. Left: the matcher is pure and wired to nothing. No upload endpoint, no screen, no ledger posting of a matched line — that is real work and it is not in this plan; Day 6 shows the paths in the back office, and actually collecting rent through them is beyond the demo.
2026-10-08 — Day 6. The back office now reflects the live mode. `web-admin/lib/deployment.ts` (a structural copy of the server resolver, for the same bundle reason `assistant/signals.ts` copies the funnel stages — the two move together), `components/deployment-provider.tsx`, and the mode read **server-side in the root layout**, which is already `force-dynamic` for Host-based branding. That matters more than it looks: it is a request-time read rather than a build-time one, so ONE built image serves all three modes and switching does not rebuild — which is what makes Day 7's switch possible at all. NAV entries carry an optional `requires` capability; `/listings` and `/applications` are tagged `publicListings` and are ABSENT rather than disabled in mode A, because the API refuses those routes and a greyed-out link is a control that leads nowhere. Everything untagged is staff work and shows in every mode, which is the premise of the sealed option. A `DeploymentChip` names the mode in the sidebar, but only on-site: a chip reading 'Private server' on an agency's screen is noise about plumbing they never asked about, whereas on-site the client paid for the machine being in their building. Unbranded, coloured from `--brand`. `compose.demo.yml` feeds both `demo-api` and `demo-web` from one `DEPLOYMENT_PROFILE` variable so they cannot drift. Typecheck clean. **The known weakness, stated rather than hidden:** the web reads its own copy of the env var instead of asking the API, so a misconfiguration that set them differently would show a menu entry the API refuses. Enforcement is still server-side and unaffected — the failure is a dead link, not an open door — and one compose variable drives both. Reading it from an API response instead would need an endpoint; worth doing if this ships beyond a demo.
2026-10-08 — Day 7. `deploy/demo/mode.sh a|b|c` switches the stack, and `web-admin/app/demo/page.tsx` is the console. **The switch does not reseed and does not rebuild.** Not reseeding is `--no-deps` on `up -d demo-api demo-web`, which is the whole safety of the script — without it compose also recreates `demo-postgres`, and the Midnight Masquerade world lives in that volume; resetting twelve months of invoices and the arrears dates mid-demo would be slow and would reset what the room just looked at. Not rebuilding falls out of Day 6: the mode is read at request time, so one image serves all three and a switch is a container restart. The script rewrites one line of `.env.demo` and leaves every other secret alone, refuses an unknown mode, and with no argument just reports the live one. The console states the live mode, where the data sits, who runs it, the IT effort, and a served/not-served row per capability driven by the same table the nav uses — so the page cannot claim something the API would refuse. For the two on-site modes it lists the four things the client supplies; for the private server it says plainly that the answer is nothing, and that this is often what a client means. **It is gated on `DEMO_CONSOLE`, set only in `compose.demo.yml`, so the route 404s in production** — a page about deployment options has no business in a real agency's back office. Every figure on it is quoted from `LOCARE_ONSITE_CLIENT_OPTIONS.md`: the 4-core / 16 GB / 500 GB spec and the four requirements. No price, no rate, no timeline, because none was agreed. Typecheck clean. Left: `mode.sh` is untested — it has never run against the demo stack, and Day 8 is where all three modes get walked end to end.
2026-10-08 — Day 8, PART ONE ONLY. `docs/LOCARE_ONSITE_DEMO_SCRIPT.md` drafted: the running order (open in C, land on the five story records, the ledger, then the switch to A on the question the room will ask, then B briefly), the seven answers to bring back, and a verification walk. **The box stays unticked.** Day 8 is 'boot each mode and walk it', and that has not happened — no part of the mode switch has run against a booted stack, so the script says what the software is designed to do, not what anyone has watched it do. It carries a PROVISIONAL banner saying exactly that. The walk checklist is in the same file, grouped by mode, ending with the five things most likely to be wrong in the order they would cost most mid-demo: the web and API reading `DEPLOYMENT_PROFILE` separately with nothing enforcing agreement; `mode.sh` never having run (`--no-deps`, the `sed` into `.env.demo`, the `exec printenv` path); whether the Expo tenant app renders the 403 as a sentence or a crash; `DEMO_CONSOLE` gating `/demo`, set in one place and tested nowhere; and the unpaginated 500-unit list. Vernon runs the walk; this run ticks nothing.
2026-10-08 — Local demo path (asked for, outside the plan). `scripts/demo-mode.ps1 a|b|c` switches the LOCAL dev stack, and the demo script gains a 'Running it locally (no VPS)' section. The deploy/demo stack cannot run on Vernon's machine — it joins the production Docker network (`deploy_default`, external) so the live Caddy can route to it, and that network does not exist there — but the ordinary dev stack runs the same code against the same database, which is all the demo needs. The script writes `DEPLOYMENT_PROFILE` into **both** `.env` (the API, which enforces) and `web-admin/.env.local` (the web, which only decides what to show), because they read it separately and setting one is the known way to get a menu entry the API refuses; run with no argument it reports both and warns when they disagree. It also sets `DEMO_CONSOLE=1` so `/demo` renders locally. Four differences from the VPS path are written into the script rather than left to be discovered mid-sentence: no Mailpit (OTP prints to the API window, the only plaintext copy), a mode switch needs both dev windows restarted because `ts-node-dev` watches source and not `.env`, two env files rather than one, and localhost hosts so the refused-tenant-login moment is done against the Expo app or a direct API call. Day 8's box still unticked: none of this has been run either.
2026-10-08 — Print-and-sign, finished (asked for, outside the plan). Building the missing print route turned up a **correction to Day 5**: `PrintSignEsignProvider` was bound correctly and was INERT. `lease-agreement.service.createForLease` never calls `ESIGN_PROVIDER` — it mints its own `las_<uuid>` ref and builds `${SIGN_BASE}/sign/<ref>` directly; the only injector of that token is `src/modules/documents/esign.service.ts`, a different flow. So in mode A a new lease still produced a tenant-facing signing link on a sealed box, AND still emailed it to the tenant. Day 5's log said the signature path was done; it was not. Fixed where the URL is actually built: `signatureUrlFor(base, ref, eSignature)` — pure and exported so the branch is testable without a tenant context — returns `/leases/print/<ref>` when the mode serves no e-signature, and the tenant email is now gated on `eSignature` as well as `sendEmail`, because mailing someone a link to a server they cannot reach is worse than sending nothing: it looks like the system worked. `web-admin/app/leases/print/[ref]/page.tsx` is the staff-facing page: it opens the ALREADY-STORED lease document rather than re-rendering it (so what is signed is what the system holds), carries a printable three-party signature block with a print-only stylesheet, and states the scan-back step. `test/lease-print-sign.spec.ts`, 5 cases, green; `lease-agreement-resend.spec.ts` still 10/10, which matters because the change sits in that service. Typecheck clean both sides. Left: the page has not been opened in a browser, and the `@media print` rule that hides everything but the signature sheet is exactly the kind of thing that needs one look to trust.
