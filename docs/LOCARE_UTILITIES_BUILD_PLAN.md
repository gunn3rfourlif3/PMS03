# Municipal utilities — capture build plan

Written 2026-10-08. Owner: Vernon. Separate from the on-site demo plan: this is
product work and it adds tables, which that plan's constraints forbid.

Agencies recover municipal utilities from tenants. The municipality meters the
building and bills the landlord; the agency reads submeters per unit and
recovers. Today that happens on paper and in spreadsheets. This captures it.

## Scope, as decided 2026-10-08

- **Per unit, with a building bulk meter.** Both, so the recovery gap — bulk
  reading minus the sum of its submeters — is visible. That gap is losses,
  common areas and leaks, and it is the number an agency actually wants.
- **Record only.** Readings, consumption and cost are stored and reportable.
  Nothing posts to the ledger and nothing touches an invoice. Recovery can be
  added later without redoing capture.
- **Electricity, water, gas** (metered) and **sewerage, refuse** (not metered —
  fixed or formula charges on the same municipal bill).
- **Manual capture.** No AMI, no municipal scraping, no OCR. Later, maybe.

## How a run works

Same as the other plans: first unticked box is today's scope, do only that day,
tick it, append one log line, stop. Typecheck what you touched. Do not commit —
Vernon runs git. Print the `git add` / `git commit` line at the end.

## Standing constraints

- **RLS ships in the same migration as the table.** Non-negotiable per
  `CLAUDE.md`: every tenant-scoped table gets a policy on
  `app.current_vendor_id` in the migration that creates it.
- **Record-only means record-only.** No ledger posting, no invoice line, no
  `utility` line item. The moment a reading bills a tenant, VAT and recovery
  rules arrive with it, and that is a separate decision.
- **Consumption is computed server-side**, never accepted from the client. A
  reading the back office sends is a dial value and a date; the API derives the
  rest from the previous reading on that meter.
- **A reading is never silently corrected.** A lower-than-previous reading is
  either a rollover or a mistake, and the capturer says which.
- Money stays in **rands** (`numeric`), as everywhere else in this schema.

## Day 1 — Schema

Read: `src/common/database/migrations/1720000040000-DebitMandates.ts` (the RLS
pattern), `src/modules/properties/unit.entity.ts`,
`src/common/database/entities.ts`.

Two tables, `utility_meters` and `utility_readings`, their entities, and one
migration carrying both plus their RLS policies. Register both in
`entities.ts`. No service, no controller, no UI today.

`utility_meters.metered` is the hinge: electricity, water and gas are metered
and their readings carry a dial value; sewerage and refuse are not, and their
readings carry only a cost for the period. One table, one capture flow, one
list — a separate "charges" table would split a screen that agencies fill in as
one sheet.

- [x] Done

## Day 2 — API

Read: the Day 1 entities, `src/modules/maintenance/` (a simple module to copy
the shape of), `src/common/tenancy/tenant-context.service.ts`.

A `utilities` module: list and create meters, list and capture readings.
Consumption derived server-side as `(reading - previous) * multiplier`, with the
rollover case explicit and an estimated flag. Reject a reading dated before the
previous one on that meter. A Jest spec in `test/` for the consumption maths —
rollover, first reading, estimated, multiplier, and the non-metered path.

- [x] Done

## Day 3 — Capture screens

Read: the Day 2 controller, `web-admin/components/shell.tsx`,
`web-admin/app/(dashboard)/` for an existing list-plus-form page to match.

A meters list, a capture form, and the readings history on a unit. The capture
form is the one that matters: a clerk works down a building with a phone or a
printed sheet, so it defaults to the next unit in the building and shows the
previous reading beside the input.

Pagination from the first commit. At 500 units an unpaginated list is a single
enormous scroll — the on-site demo found that the hard way.

- [x] Done

## Day 4 — The recovery gap, and verify

Read: the Day 2 service, the Day 3 pages.

Per property per period: the bulk reading, the sum of its submeters, and the
difference in units and rand. CSV export, because the first thing an agency
does with this is check it against the municipal bill.

Then verify: typecheck both sides, the Day 2 spec green, and capture a reading
end to end against a real unit.

- [x] Done

## Open questions

- (a) Tariffs are per-reading (`tariff_rate`) for now. Stepped municipal tariff
  blocks are real and common; if agencies need them modelled, that is its own
  table and its own decision.
- (b) **Decided 2026-10-08: actual cost, passed through.** No margin. The
  pure builder is `src/modules/utilities/utility-recovery.ts`; it produces
  tax-EXCLUSIVE lines and leaves VAT to `buildRentInvoice`, the same path rent
  takes. **Still open and NOT answered in code: whether a pass-through utility
  recovery should carry VAT at all.** That is a question for whoever does the
  agency's returns. The builder is also not wired to invoicing yet — it turns
  readings into lines and nothing calls it.
- (c) No prepaid-electricity model. Prepaid is a token purchase, not a reading,
  and it does not fit this shape at all.

## Log

One line per run: date, day number, what landed, anything left.
2026-10-08 — Day 1. `utility_meters` and `utility_readings`: entities under `src/modules/utilities/`, migration `1720000055000-UtilityMeters.ts` carrying both tables **and their RLS policies**, both registered in `entities.ts`. A meter hangs off a unit XOR a property, enforced by `ck_utility_meters_attachment` — the recovery gap is only computable if bulk and submeter are distinguishable. `metered=false` carries sewerage and refuse, whose readings hold a cost and nothing else. `consumption` is a stored column, derived server-side on Day 2 and never accepted from the client; stored rather than computed on read so correcting an old reading cannot silently restate a period already reported on. `rollover` is set by the capturer, not inferred from a lower reading — inference cannot tell a wrap from a typo, and guessing wrong either doubles a bill or hides a leak. Two partial unique indexes: one live meter per serial per vendor (removed meters keep their serial for history, and a replacement may reuse it), and one reading per meter per day (a same-day recapture is a correction; stacking two would yield a zero-consumption period nobody can explain). Multiplier defaults to 1 for domestic meters and carries the CT ratio for large installations. Typechecks in isolation. Left: migration not yet run — `npm run migration:run` is the test; no service, controller or UI yet (Day 2, Day 3).
2026-10-08 — Day 2. `src/modules/utilities/`: `utility-calc.ts` (pure, no framework or DB deps), `utilities.service.ts`, `utilities.controller.ts`, `utilities.module.ts`, registered in `app.module.ts`. Endpoints are staff-only (`vendor_owner`, `property_manager`) — a tenant-submitted reading is a different feature with a verification problem attached. Consumption is derived server-side and never accepted from the client. The maths: first reading returns null, not zero, because a baseline reported as zero is indistinguishable from a tenant who used nothing; a rollover wraps past 10^dialDigits and is REFUSED without those digits; a lower reading with no rollover flag is refused outright rather than guessed at. The service also refuses a capture dated before an existing later reading — back-filling would leave that later reading's stored consumption measuring from the wrong baseline — and refuses an unmetered capture with no cost. Removing a meter sets `status='removed'` rather than deleting: its readings are the history of a real municipal account. `test/utility-calc.spec.ts`, 16 cases, green. Typecheck clean. One correction worth recording: an isolated typecheck of mine ran with `strictNullChecks` off and reported a narrowing failure on the result union — that was my harness, not the repo, which has `strictNullChecks: true`. The `isConsumptionError` guard added in response is kept because it costs nothing and holds either way, and the comment that first claimed the project had the flag off has been corrected. Left: Day 1's migration and this module are both still unrun against a database — `npm run migration:run` then a capture through the API is the real test.
2026-10-08 — Day 3. `web-admin/app/utilities/page.tsx`, a `Utilities` nav entry, and five calls added to `lib/api.ts`. One page: meters list, an add-meter form that switches between a unit submeter and a property bulk meter, and a capture panel. The capture panel shows the previous reading and its date beside the input, or says plainly that a first reading sets a baseline and records no consumption; after saving it reopens on the same meter so a clerk working down a building keeps going rather than re-finding their place. Rollover and estimated are checkboxes, since both are the capturer's assertion and neither can be inferred. The add-meter form shows dial digits only for metered utilities and says why they matter. **Pagination is server-side**: `listMeters` now returns `{rows,total,limit,offset}` and takes `limit`/`offset` — a small extension to Day 2's API rather than a client-side slice, because a submeter per unit per utility at 500 units is thousands of rows and paging them in the browser still ships them all. Both sides typecheck clean. Left: still unrun against a database — migration, then a capture end to end, is Day 4's verification; and the unit and property selects fetch the full list with no search, which is fine at 10 properties and poor at 500 units.
2026-10-08 — Day 4. `utility-gap.ts` (pure) + `GET /utilities/recovery-gap` + a Recovery gap panel on the utilities page with CSV export. Per property, per utility, per month: bulk against the sum of the submeters under it, in units and in rand, with the gap as a percentage of bulk. Built from two aggregates merged in memory rather than one FULL OUTER JOIN, because a period can exist on either side alone and both cases matter — a property with a bulk reading and no submeter readings is exactly what an agency wants to see. The decision that shapes it: **a gap needs both sides**, so a missing bulk or missing submeter reading yields null and a stated reason, never a number. Treating a missing bulk as zero would report the whole submetered total as a surplus; treating missing submeters as zero would report the whole bulk as a loss. A negative gap is kept rather than clamped — submeters exceeding bulk is real and means a misassigned meter or a bulk read on the wrong day. No percentage against a zero bulk. `test/utility-gap.spec.ts`, 10 cases; both specs green at 26. CSV is built in the browser from rows already fetched rather than as a second authed download route; the quoting rule (a property called `Smith, J`) is tested server-side and mirrored in `web-admin/lib/utility-gap-csv.ts`, which is the one piece of duplication here and is commented as such. Both sides typecheck clean. **Left, and it is the whole of the remaining risk: none of these four days has run against a database.** `npm run migration:run`, then add a bulk meter and a submeter and capture a reading on each, is the verification this plan asks for and I cannot perform from here.
2026-10-08 — Recovery builder (asked for, outside the four days). `src/modules/utilities/utility-recovery.ts`: actual cost passed through, per the 2026-10-08 decision. Pure. Readings are grouped into one line per utility rather than one per capture — a tenant's invoice should say 'Water' and an amount, not list four meter readings — with the reading ids carried on the line so a charge traces back. **A bulk meter is refused outright**: its cost is the landlord's, and recovering it from one tenant would charge them for the whole building, so the builder checks rather than trusting the caller filtered. A reading with usage but no cost is skipped, not priced from a tariff nobody entered; a first reading is reported as `baseline` rather than `no_cost`, since those are different problems. An estimated reading IS recovered but says so on the line — waiting for someone to walk the building is how three months of charges arrive at once. Amounts are tax-exclusive so `buildRentInvoice` computes VAT once, as it does for rent. `test/utility-recovery.spec.ts`, 10 cases, green. Left: **nothing calls it.** It turns readings into invoice lines and no invoicing path uses them yet; and whether a pass-through recovery should carry VAT at all is a tax question, flagged in open item (b) rather than answered here.
