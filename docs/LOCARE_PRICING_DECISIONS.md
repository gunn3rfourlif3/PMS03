# Locare — pricing decision record

Decided 2026-09-10. Owner: Vernon. Supersedes the pricing notes scattered
through `subscription-calc.ts`, the onboarding runbook and the partner
curriculum — where those disagree with this document, this document is right and
they are stale.

This exists because pricing had already drifted once: a live agency was being
shown "free Starter plan, R250/unit/month" months after that model was replaced,
because the numbers lived in three places and only one of them was updated.

---

## The ladder

| Tier | Units | Monthly, ex-VAT | Incl. VAT | Published? |
|---|---|---:|---:|---|
| **Custom** | 1–69 | **R85.91 per unit** | — | **No** |
| Starter | 70–199 | R6,014 | R6,916 | Yes |
| Growth | 200–499 | R12,600 | R14,490 | Yes |
| Scale | 500+ | R22,100 | R25,415 | Yes |
| Enterprise | any | manual | — | No |

Zero units bills nothing, on any tier.

### Why R85.91

It is R6,014 ÷ 70 — Starter's fee divided by Starter's entry point. It is
**derived in code, not typed in**, so a future reprice of Starter carries the
Custom rate with it. The consequence that matters: 69 units bills R5,928 and 70
bills R6,014, so there is no cliff for a growing agency to fall off and no
reason for anyone to misreport a unit count near the boundary.

It also holds the fee at a constant ~10% of what the agency earns (assuming
R850/unit — R10,000 rent at 8.5%) at every size below the entry point. A flat
fee cannot do that: R6,014 against 11 units is 64% of their income.

### The minimum: 30 units

An agency with fewer than 30 units is billed as if it had 30 — **R2,577/month**.

Cost to serve scales with *agencies*, not units. Onboarding is 15–25 hours and
support is roughly constant whether the portfolio is twelve units or a hundred
and ninety. At 30 units a realistic R13,200 onboarding pays back in about seven
months; at twelve units it takes nearly three years, which is longer than a small
agency's likely life as a customer.

**This is a function of onboarding cost, not a principle.** Three things would
justify lowering it: on-demand TLS removing the manual Caddy step, a CSV importer
replacing manual unit loading (the biggest single cost, and the one that scales
with agency size), and a self-serve branding form. Land those and 20 units pays
back in the same seven months. Revisit then.

Billing **refuses to invoice** an agency below the minimum until a human has
agreed the price through a `price_override`. Being charged for units you do not
have is defensible as policy but is not something to discover from an invoice.

---

## Decisions

| # | Decision | Answer |
|---|---|---|
| A1 | Rate derived or pinned | **Derived** — `STARTER_PRICE / STARTER_MIN_UNITS` |
| A2 | Rounding | Rate to the **cent**, invoice to the **rand** |
| B1 | Minimum billable units | **30** |
| B2 | Expressed as | **Units**, not a rand floor |
| B3 | Override may go below it | **Yes** — that is what overrides are for |
| C1 | Setup fee | **Yes, R9,500** |
| C2 | Charged | Once-off, discountable |
| C3 | Applies to | **Every** new agency, not just Custom |
| C4 | Waived for | **First 10 customers**, in exchange for a reference |
| D1 | `custom` in the data | **Yes**, a real tier value |
| D2 | Agency sees | **Full breakdown** — rate, units charged, total |
| D3 | Commission treatment | Its own tier; accrual is on cash collected regardless |
| E1 | Billing basis | **Units under management**, vacancies included |
| E2 | Snapshot | Unit count as at generation on the 1st |
| E3 | Ratchet on small swings | **No** |
| E4 | Pro-rate a mid-month start | **No**, for now |
| F1 | Zero units | Bills **zero**, always |
| F2 | Growing past 70 | Automatic move to flat Starter |
| F3 | Shrinking below 70 | Automatic move to per-unit (a decrease) |
| G1 | Partners may quote the rate | **Yes** |
| G3 | Rate in the partner curriculum | **Yes** |
| G2 | Website | Says "fewer than 70 units — talk to us", never the rate |
| H1 | Billing guard | Fires below the **minimum** with no active override |
| I1 | Dantalan | Override at R925 stands to **2027-03-31** |
| I2 | Dantalan review | Diarise **January 2027** |
| J1 | Published band edges | **Unchanged** |
| J2 | The 199→200 cliff | **Noted, not fixed** |

### E1, and the argument you will eventually have

Billing counts units under management, which includes vacancies. Under a flat
band nobody notices. Under per-unit pricing a 40-unit agency with 8 vacant units
pays for 40 while earning commission on 32 — and they will do that arithmetic,
because now they can.

This was chosen deliberately: you manage the vacancy too, and a vacancy-adjusted
count would make revenue depend on the agency's letting performance. **Say it at
intake** (stage 0.4) rather than letting it surface on an invoice.

### C1–C4, not built

The setup fee is **policy only**. `subscription_invoices` is one row per vendor
per period and has no concept of a once-off charge, so today the fee is raised by
hand outside the system. Automating it is separate work and has not been
scheduled.

---

## What this changed in the code

- `subscription-calc.ts` — `customUnitRate()`, `billableUnits()`, `customPrice()`,
  `belowMinimum()`, `MIN_BILLABLE_UNITS`; `tierForUnits()` returns `custom` below
  the entry point
- `vendor-subscription.entity.ts` — `'custom'` added to `SubscriptionTier`. The
  `tier` column is free text, so **no migration was needed**
- `subscription-billing.service.ts` — the guard now fires on `belowMinimum`
  rather than `belowFloor`, and reports a `blocked` count
- `subscriptions.controller.ts` — `GET /subscription` returns `custom: { unitRate,
  billableUnits, minUnits }` so the agency can check its own bill
- `web-admin/app/billing/page.tsx` — Custom label, per-unit breakdown, and a
  "By arrangement" state while a below-minimum price is unagreed

## Still open

- Re-qualify the JHB North prospect list against the 70-unit boundary — most of
  it sits in the Custom tier, which is now sellable rather than a blocker
- Automate the setup fee, or accept it stays manual
- The 199→200 cliff: one extra unit takes an agency from R6,014 to R12,600
- Whether a signed service agreement and POPIA processing clause exist at all
