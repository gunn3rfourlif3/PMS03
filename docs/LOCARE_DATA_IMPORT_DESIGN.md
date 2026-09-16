# Locare — agency data import

Written 2026-09-12. Owner: Vernon. Status: **built** (16 Sep), all three phases.

Implements **R-5** from `LOCARE_AGENCY_ONBOARDING_REQUIREMENTS.md`. Stage 5 of
the onboarding runbook is entirely manual entry today and is the bulk of the
week: roughly 7 of the 22 hours in `LOCARE_PRICING_DECISIONS.md`, and the only
line item that scales with the size of the agency.

**Acceptance, from R-5:** a 60-unit agency's data is loaded and verified in under
an hour, with a dry-run report the principal signs.

---

## 1. The two things that make this hard

**The format is not ours.** Agencies arrive with a spreadsheet shaped by whatever
they used before — an incumbent PMS export, a bookkeeper's workbook, or a sheet
one person has maintained for nine years. R-5 warns that an importer built
against an imagined format will not fit real data. The answer here is not to
guess better: it is to **never require a particular format**. The operator maps
the agency's columns onto Locare's fields on screen, and the mapping is saved per
agency so the second file costs nothing.

**Opening balances are irreversible.** Properties, units and leases can be
corrected with an edit. A posted ledger transaction cannot — `LedgerService`
is append-only and `reverse()` is the only undo, by design, because that is what
makes a trust ledger auditable. So money is the last thing imported, it is
posted in clearly identified batches, and a human signs the numbers first.

## 2. Scope

In dependency order, which is also import order:

| # | Entity | Reversible? |
|---|---|---|
| 1 | Owners | Yes — edit |
| 2 | Properties | Yes — edit |
| 3 | Units | Yes — edit |
| 4 | Tenants (users) | Yes — edit |
| 5 | Leases | Yes — edit |
| 6 | Deposits held | **Posts to the ledger** |
| 7 | Arrears / opening balances | **Posts to the ledger** |

Owners carry banking details and tenants carry personal information, so an
uploaded file is POPIA-relevant from step 1. See §7.

## 3. The flow

```
upload  →  map columns  →  dry run  →  review  →  commit
                ↑______________|
             (fix and re-run, as often as needed)
```

**Upload.** A CSV or XLSX per entity. The file is parsed for headers only at
this point; nothing is created.

**Map.** The operator matches the agency's column names to Locare's fields.
Obvious matches are pre-selected by name similarity; everything else is chosen
from a dropdown. Required fields that are unmapped block the dry run and say so.
The mapping is stored on the batch and offered as the default next time this
agency uploads the same entity.

**Dry run.** Every row is parsed, validated and resolved against what already
exists, and the result is a report: what would be created, what would be
updated, and what is wrong — with the row number and the offending value. **The
dry run is the point of the feature.** It converts silent errors into a list
someone can check before anything is written.

**Commit.** Applies exactly what the dry run showed, in one database
transaction. If the file changed between the dry run and the commit, the commit
is refused rather than applying something nobody reviewed.

## 4. Matching, so a re-run is safe

Re-uploading a corrected file must fix rows, not duplicate them. Each entity has
a natural key within the agency:

| Entity | Natural key |
|---|---|
| Owner | name |
| Property | name |
| Unit | property + label |
| Tenant | email, else phone in E.164 |
| Lease | unit + start date |
| Deposit | lease |
| Opening balance | lease |

A row whose key exists is an **update**; a row whose key is new is a **create**.
The dry run says which, per row, before anything happens.

Ledger postings are the exception: they are **not** re-runnable. A lease that
already has an opening balance from a previous batch is reported as "already
posted, skipped" rather than posted twice.

## 5. Opening balances

The part to get right.

**Arrears.** One invoice per lease, for the period before go-live, with a single
line item reading `Opening balance as at <date>`, plus a balanced journal:

```
DR  1000  Accounts Receivable      <arrears>
CR  3000  Opening Balances         <arrears>
```

`3000 Opening Balances` (equity) does not exist yet and is added to
`STD_ACCOUNTS`. The alternative — reconstructing each historical month as its own
invoice — is more faithful but requires data the agency almost never has, and
invents detail nobody can verify. One dated opening figure the principal has
signed is more honest than twelve fabricated ones.

**Deposits.** A `deposits` row per lease plus:

```
DR  1200  Trust Bank (segregated)  <amount>
CR  2200  Tenant Deposits (trust)  <amount>
```

Only where the money genuinely sits in a trust account. The CSV carries
`held_in`, and if it says the deposit is held by the landlord or a previous
agent, the deposit record is created and **no ledger entry is posted** — because
Locare is not holding that money and the trust bank balance would not reconcile.
This distinction is the one most likely to be got wrong on a first import and
the one an auditor will find.

**Every posting carries the batch id** in `entity_ref`, so a whole import can be
identified and, if necessary, reversed as a set.

**Sign-off.** The dry run produces a printable arrears and deposit schedule —
lease, tenant, amount, total. Runbook stage 5.4 already requires the principal to
sign this off; this makes it a document rather than a conversation.

## 6. Data model

```
import_batches
  id, vendor_id, entity, status, filename, uploaded_by,
  mapping jsonb, source_digest text, report jsonb,
  created_at, committed_at, committed_by, ledger_batch_ref
```

`status`: `mapping | dry_run | committed | discarded`.
`source_digest` is a hash of the uploaded file, which is what lets the commit
refuse a file that changed after it was reviewed.

Row-level detail lives in `report` rather than its own table: a batch is
reviewed and committed within minutes, and a 500-row JSON document is cheaper
than a table nobody queries afterwards.

## 7. POPIA and the uploaded file

From step 1 these files contain other people's personal information — tenant
names, contact details, ID numbers, and owners' banking details.

- The uploaded file is held only until the batch is committed or discarded, and
  **deleted after 7 days** by `ImportsScheduler` (03:45 UTC daily, BUILT
  2026-09-12). `IMPORT_RETENTION_DAYS` shortens the window; nothing lengthens
  it without a reason written down here.
- The dry-run report stores values that failed validation, so it is scrubbed on
  the same schedule.
- Banking details in an owner import go through `encryptedJson` like every other
  banking record; they are never written to the report or a log.
- The runbook already tells operators not to copy agency data onto personal
  machines. The importer is what makes that instruction followable.

## 8. Build order

**Phase 1 — templates and the parser.** A downloadable CSV template per entity
with the exact columns and an example row, plus upload, header detection and the
mapping UI. Templates alone are useful before any of the rest exists, which is
why R-5 puts them first.

**Phase 2 — dry run and commit for the reversible entities** (owners →
properties → units → tenants → leases). This is the bulk of the 7 hours.
**Built 16 Sep**, `import-commit.ts`. Three things settled while building it:

- **A commit re-runs the check and compares the counts** against the report the
  operator approved. The file cannot change — its bytes are held in the row —
  but the database can, via another import, a manual edit or a second operator.
  A plan that no longer reads the same is refused, not merged.
- **Two gaps in the dry run turned up.** A lease was never matched against an
  existing one, so a re-upload created a second copy of every lease; and the
  tenant on a lease was never resolved, so a row could report "create" and then
  write a lease attached to nobody, which bills nobody and stays invisible until
  the first rent run comes up short. Both are now resolved at check time, and
  the resolved tenant id is carried to the commit so the two cannot disagree.
- **An imported lease lands `active`, not `draft`** — it describes a tenancy
  that already exists, and a draft bills nobody. One already past its end date
  lands `ended`, so a historical file cannot start invoicing people who left.
  An active lease also flips its unit to `occupied`, or the vacancy figures are
  wrong from day one.

**Phase 3 — deposits and arrears**, with the signed schedule. Last, deliberately.
**Built 16 Sep**, `import-money.ts` and `import-schedule.ts`. Five decisions:

- **An opening balance credits EQUITY, not rental income.** That rent was earned
  under the agency's previous system. Recognising it as income at go-live would
  overstate the period, and both the management fee and VAT are computed off
  income — so the error would follow the money out of the business. New standard
  account `3000 Opening Balances (migration)`.
- **It also raises an invoice.** Arrears and the rent roll are read from
  `invoices`, not the ledger, so a balance posted only to the ledger would be
  invisible on the dashboard while the tenant genuinely owed the money. The
  invoice is dated `asAt`, so months-old arrears age from when they were struck
  rather than landing in the 0–30 bucket, and it is marked `lateFeeApplied` so
  Locare's dunning does not charge a late fee on debt inherited from the
  previous agent.
- **Only `locare_trust` deposits post.** Anything held by the landlord or a
  previous agent is recorded and shown, never posted: booking it as trust cash
  puts the trust bank out against the real bank balance, which is the one
  reconciliation a letting agency cannot afford to get wrong.
- **One ledger transaction per batch.** A single balanced journal with a line per
  lease, so `ledger.reverse(id)` undoes an entire import in one call, and
  `import_batches.ledger_batch_ref` records which one.
- **The signature is tied to the figures.** The schedule carries a fingerprint of
  the exact amounts, order-independent so re-sorting a sheet does not invalidate
  it, but sensitive to a single cent and to the same total moving between
  tenants. Commit refuses unless the fingerprint still matches, so a signature
  can only ever authorise numbers that were actually in front of someone.

A second opening balance for the same lease is **blocked at the check**: doubling
a tenant's arrears in an append-only ledger is remediable only by a reversing
entry, so it is refused rather than discovered.

## 9. Open questions

- Does the agency ever upload directly, or is this always operator-driven? The
  console's Phase 4 tokenised view would be the natural home if so.
- XLSX as well as CSV? Agencies send .xlsx far more often than .csv, and asking
  a principal to "save as CSV" is a step that goes wrong.
- ~~Does a failed commit roll back the whole file, or apply the good rows?~~
  **Settled 16 Sep: both, deliberately.** A row the check *blocked* is skipped
  and named, so two bad rows in five hundred do not cost a re-upload — but the
  operator has to confirm they have seen them. A row that *fails while writing*
  rolls the whole file back, because `runInVendorContext` is one transaction and
  a half-written portfolio is worse than a rejected one: nobody can tell by
  looking which half arrived.
