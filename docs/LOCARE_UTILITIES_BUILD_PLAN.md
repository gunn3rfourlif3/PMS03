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

- [ ] Done

## Day 4 — The recovery gap, and verify

Read: the Day 2 service, the Day 3 pages.

Per property per period: the bulk reading, the sum of its submeters, and the
difference in units and rand. CSV export, because the first thing an agency
does with this is check it against the municipal bill.

Then verify: typecheck both sides, the Day 2 spec green, and capture a reading
end to end against a real unit.

- [ ] Done

## Open questions

- (a) Tariffs are per-reading (`tariff_rate`) for now. Stepped municipal tariff
  blocks are real and common; if agencies need them modelled, that is its own
  table and its own decision.
- (b) Nothing here recovers anything. The `utility` invoice line kind already
  exists in `InvoiceLineItem`, so the billing side anticipates recovery — but
  what to recover (actual, actual plus a margin, a flat rate) is a commercial
  decision, not a schema one.
- (c) No prepaid-electricity model. Prepaid is a token purchase, not a reading,
  and it does not fit this shape at all.

## Log

One line per run: date, day number, what landed, anything left.
2026-10-08 — Day 1. `utility_meters` and `utility_readings`: entities under `src/modules/utilities/`, migration `1720000055000-UtilityMeters.ts` carrying both tables **and their RLS policies**, both registered in `entities.ts`. A meter hangs off a unit XOR a property, enforced by `ck_utility_meters_attachment` — the recovery gap is only computable if bulk and submeter are distinguishable. `metered=false` carries sewerage and refuse, whose readings hold a cost and nothing else. `consumption` is a stored column, derived server-side on Day 2 and never accepted from the client; stored rather than computed on read so correcting an old reading cannot silently restate a period already reported on. `rollover` is set by the capturer, not inferred from a lower reading — inference cannot tell a wrap from a typo, and guessing wrong either doubles a bill or hides a leak. Two partial unique indexes: one live meter per serial per vendor (removed meters keep their serial for history, and a replacement may reuse it), and one reading per meter per day (a same-day recapture is a correction; stacking two would yield a zero-consumption period nobody can explain). Multiplier defaults to 1 for domestic meters and carries the CT ratio for large installations. Typechecks in isolation. Left: migration not yet run — `npm run migration:run` is the test; no service, controller or UI yet (Day 2, Day 3).
2026-10-08 — Day 2. `src/modules/utilities/`: `utility-calc.ts` (pure, no framework or DB deps), `utilities.service.ts`, `utilities.controller.ts`, `utilities.module.ts`, registered in `app.module.ts`. Endpoints are staff-only (`vendor_owner`, `property_manager`) — a tenant-submitted reading is a different feature with a verification problem attached. Consumption is derived server-side and never accepted from the client. The maths: first reading returns null, not zero, because a baseline reported as zero is indistinguishable from a tenant who used nothing; a rollover wraps past 10^dialDigits and is REFUSED without those digits; a lower reading with no rollover flag is refused outright rather than guessed at. The service also refuses a capture dated before an existing later reading — back-filling would leave that later reading's stored consumption measuring from the wrong baseline — and refuses an unmetered capture with no cost. Removing a meter sets `status='removed'` rather than deleting: its readings are the history of a real municipal account. `test/utility-calc.spec.ts`, 16 cases, green. Typecheck clean. One correction worth recording: an isolated typecheck of mine ran with `strictNullChecks` off and reported a narrowing failure on the result union — that was my harness, not the repo, which has `strictNullChecks: true`. The `isConsumptionError` guard added in response is kept because it costs nothing and holds either way, and the comment that first claimed the project had the flag off has been corrected. Left: Day 1's migration and this module are both still unrun against a database — `npm run migration:run` then a capture through the API is the real test.
