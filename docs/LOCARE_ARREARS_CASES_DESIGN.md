# Locare — arrears cases

Written 2026-09-13. Owner: Vernon. Status: design, not built.

The first and largest piece of the **attention engine** — one screen that tells a
property manager the few things that need doing today. The other pieces
(load-shedding overlay, inspection routing, the landlord portfolio view) are
separate and depend on address work this one does not need.

**Not legal advice.** Sections 8 and 11 state positions on South African rental
law that must be confirmed by an attorney before this ships. They belong on the
same list as the trust-account question and the R-11 operator agreement.

**Acceptance:** an agency that has been quietly losing money to a tenant who
short-pays every month sees that case opened, with the reason in a sentence,
before the balance reaches one month's rent — and no case in the system ever
sits with a lapsed notice period without appearing at the top of the list.

---

## 1. What this is, and what it is not

The agency already knows who owes money. The rent roll shows it and so does
every competitor's. An attention engine that lists overdue tenants is a second
rent roll.

The expensive failure in South African arrears is not the arrears — it is **a
clock that lapsed**. A breach notice gives the tenant a fixed number of business
days to remedy. Nobody acts on the day it expires. Six weeks later the agency has
arguably waived the breach and starts again, three months of a landlord's rent
have gone, and the mandate moves to a competitor.

So this feature tracks **process, not balances**, and the list it produces is
ordered by *which clocks have run out or are about to*.

---

## 2. Why the chronic case is invisible today

`payment-alloc.ts` applies a payment to a **nominated invoice**. There is no
account-level allocation rule. So for a tenant who pays R7,500 against R8,000
every month:

| Payments pointed at | Oldest open item after 8 months | Balance |
|---|---|---|
| The current month | 240 days | R4,000 |
| The oldest open invoice | ~30 days | R4,000 |

Same tenant, same money, opposite readings — and the second one is what an
aging report shows in most systems, because oldest-first is the conventional
choice. The agency sees "one month behind" for a year while R4,000 accumulates.

**Therefore: days-overdue cannot be a primary trigger.** It is an artefact of a
bookkeeping decision, not a property of the debt. The primary trigger is the
balance and its trend.

This is also why the chronic case is worth building for. It is invisible in
every competitor's aging report for the same structural reason.

---

## 3. What opens a case

Agency-configurable, evaluated as an **OR** across a fixed set of named
conditions. Any one of them opens a case.

| Condition | Default | Catches |
|---|---|---|
| Rent arrears exceed **N x monthly rent** | 0.5 | The workhorse |
| Rent arrears exceed **R X** | R10,000 | High-value units |
| Short in **K of the last N months** | 3 of 6 | Chronic, early |
| Oldest unpaid item older than **D days** | 45 | Acute |
| **F** failed debit orders in a window | 2 in 90 days | Earliest signal |

A multiple of rent is the default rather than a rand amount because R4,000 means
something different on a R6,000 flat and a R25,000 house, and a mixed book would
need a threshold that is wrong at both ends.

"Short in K of the last N months" is the condition that would catch the
eight-month R500 short-payer in month three rather than month eight.

### Configurable, not programmable

The obvious failure is that "agency-configurable" becomes a rules engine — a
condition builder, an expression language, a screen nobody understands. It must
not. A fixed condition set with agency-set numbers, rendered as a sentence:

> Open a case when rent arrears pass **0.5x** the monthly rent, or they are short
> in **3** of the last **6** months, or **2** debit orders fail in **90** days.
> Ignore anything under **R50**.

That is configurable enough for every agency Locare will meet and cannot be
misconfigured into nonsense.

### Three details that stop it being noise

- **Hysteresis.** Open at the threshold; close only on full clearance or an
  explicit human decision — never on dropping back below it. Otherwise a R100
  payment closes and reopens the case and the screen loses trust in a fortnight.
- **De minimis.** A floor (default R50) below which nothing opens. Rounding,
  bank charges, R12 differences.
- **Quiet period.** A closed case cannot reopen for N days (default 14).

---

## 4. What the balance must exclude

**The deposit.** A tenant with a R8,000 deposit and R4,000 in arrears is not
covered: the deposit is held against damages and generally cannot be applied
mid-lease. Netting them hides chronic cases behind their own deposits for months.

**Locare's own late fees.** `DunningService` applies a percentage fee to overdue
invoices, which compounds. After eight months a meaningful share of the balance
is fees rather than unpaid rent. Opening a cancellation-track case where half the
balance is the agency's own charges is legally weak and reads badly at a
Tribunal.

So the case model carries **three numbers, separately**: rent arrears, fees, and
deposit held. Conditions in section 3 evaluate against **rent arrears only**.
The other two are displayed, never summed into the trigger.

**Fees stop when withholding is suspected.** Once a case is flagged
`possible_withholding` (section 6), `DunningService` applies no further late fees
to that lease. Charging a fee on rent the tenant may be lawfully withholding
compounds the weakness of the agency's position, and it is the first thing the
other side will point at.

Fees already charged are **not** reversed automatically — the ledger is
append-only and `reverse()` is a deliberate act. The case offers a button, and
whoever presses it is recorded.

---

## 5. Case shape: acute and chronic

Carried on the case, decided at open, and it changes the default path.

**Acute** — little or nothing paid this month. Usually an event: a job loss, a
bank problem, a death. Move quickly, because the balance compounds monthly.

**Chronic** — consistently short by a small margin. This is a *decision*, not an
event, and the right first move is a conversation, then a rent review or an
arrangement. Pushing it down the cancellation track is both harsher and weaker:
a court weighing what is "just and equitable" looks very differently at a tenant
paying 94% than at one paying nothing.

The engine must not treat them as the same case with different numbers.

---

## 6. The maintenance cross-check

**Build this even if nothing else in section 5 onward gets built.**

A tenant who short-pays may be withholding because of an unrepaired defect. That
is a real defence in South Africa and it is common. If a maintenance ticket has
been open on the unit for ninety days and the tenant has been short for three
months, those are almost certainly the same fact — and an agency that issues a
breach notice without noticing walks into a Tribunal loss with its own ticket log
as the evidence against it.

Therefore every case surfaces open maintenance on that unit, with age, at the
top. Where **a ticket predates the first short payment**, the case is flagged
`possible_withholding`, says so in words, and **will not offer escalation**
until someone has opened the ticket and recorded a view.

No competitor can do this without the maintenance module and the ledger in one
product. It is the single strongest argument in the feature.

---

## 7. Stages

    reminder -> contact -> breach notice -> cancellation -> attorney -> court
                                                     \-> recovered / written off / lease ended

Two rules on transitions:

**Guarded.** `attorney` is unreachable without a served breach notice whose
clock actually expired. That sequence is exactly what gets a matter thrown out,
so the model refuses it rather than warning about it.

**Entered by a person.** Automating a reminder is fine. Automatically escalating
a human being toward eviction is not something software should do by itself.
The engine proposes; an operator commits.

**Hard boundary.** Eviction requires a court order under the PIE Act, always.
Lock-outs and cutting water or power are criminal offences, not leverage. No
screen in Locare may imply otherwise, and the stage after `cancellation` states
plainly that what follows is a legal process the agency's attorney runs.

---

## 8. The clock

The highest-value eighty lines in the feature.

**Business days, not calendar days.** A 20-business-day notice is not 28 days.
South Africa has around twelve public holidays, several moveable (Good Friday,
Family Day), plus the rule that a public holiday falling on a Sunday is observed
on the Monday. Computing it wrong means acting early — which a court can treat
as defective — or late, which risks waiver.

A `business-days.ts` pure module with a maintained holiday table, tested against
known dates. Every generic PMS counts calendar days; this is why.

**The period is per-lease, not global.** The lease's own breach clause governs,
commonly 7 or 20 business days. Where the Consumer Protection Act applies,
section 14 gives 20 business days to remedy a material breach — but applicability
turns on whether the **landlord** lets in the ordinary course of business, so one
private landlord's single flat may sit outside the CPA while the rest of the same
agency's book sits inside it.

So: `breach_notice_days` and `cpa_applies` are fields on the lease, defaulted per
owner, and the **lease-parsing module should extract the breach clause at
intake** rather than leaving it to be typed.

---

## 9. Payments and arrangements

**A payment does not silently reset the clock.** A part payment may acknowledge
the debt — which matters for prescription — but does not cure a breach unless the
lease says so. An engine that auto-closes on any payment will restart a process
the agency was three weeks into, repeatedly, and nobody will understand why cases
never progress.

So a payment against an open case surfaces a **decision**:

> R3,000 received against R11,400. Does this cure the breach?

Yes closes the case. No keeps the clock running. Either way the decision is
recorded — which is itself the evidence that the agency did not waive the breach.

**Arrangements are a first-class object.** They are ubiquitous here and they are
where agencies lose control: the tenant agrees to clear arrears over three
months, the case is treated as sorted, the arrangement breaks in month two, and
the process restarts from zero.

An arrangement has instalments and dates. While it is honoured the case is
**paused**. A missed instalment **resumes the case at the stage it was at** — not
at the beginning. That single behaviour is worth real money to a landlord and
demonstrates in thirty seconds.

**An arrangement is also a written acknowledgement of debt**, which interrupts
prescription (section 16). So is a part payment. The arrangement record therefore
does double duty, and the case stores `last_acknowledged_at` on every payment and
every signed arrangement.

---

## 10. The evidence chain

What turns this from useful into defensible.

A breach notice must be delivered per the lease's *domicilium* clause, and
matters are lost on defective service more often than on the merits. So every
stage transition captures: what was sent, to which address, by which method,
when, and whatever delivery proof exists. WhatsApp delivery and read receipts are
genuinely useful here and the channel is already wired for OTPs.

The output is that an agency hands its attorney a complete, dated, evidenced
timeline instead of reconstructing one from an inbox.

---

## 11. Where Locare's liability sits

**Locare provides the clock and the record. The agency provides the legal
content.** Letter templates are the agency's own, approved by the agency's own
attorney, stored against the vendor.

If Locare ships default demand letters, Locare is arguably giving legal advice to
every agency on the platform, in nine provinces, from one template. It must not.

This is also the easier thing to sell: Locare is not telling an agency how to run
collections, it is making sure they never miss a date.

---

## 12. What the screen shows

Ranked, in this order:

1. **Lapsed clocks** — a notice period expired and nothing happened. The
   expensive ones.
2. **Expiring within 3 days.**
3. **Broken arrangements.**
4. **New cases** opened since last look.
5. Everything else by rent-weighted exposure — a R25,000 unit in month two
   outranks a R6,000 unit in month four.

Capped at **ten**, with the rest one click away. A list of 200 is ignored within
a week.

Each row is one plain sentence and one button that does the obvious next thing.

---

## 13. One case per lease

A tenant with two units in arrears has **two cases**.

One case per tenant is tempting, because they are one person having one
conversation. It was rejected because almost everything that happens to a case
attaches to a lease, not a person:

- **The money belongs to an owner.** Two units may have different landlords, and
  each owner's arrears are their own. A merged case would put one owner's debt
  onto another's statement.
- **The breach clause is per lease.** Two leases can carry different notice
  periods, and one may be CPA-covered while the other is not (section 8). A
  single case would have to hold two clocks.
- **Cancellation is per lease.** There is no such thing as cancelling a tenant.

### The cost, and the mitigation

The risk is the tenant being chased twice, by two managers, on the same day —
which makes an agency look disorganised to someone already unhappy.

So each case carries `relatedCases`: other open cases for the same tenant within
the vendor. The screen says *"This tenant also has an open case on 14 Rosebank
Mews — Sipho Dube is handling it"*, and the daily digest (section 14) groups a
manager's cases by tenant where they share one.

The cases stay separate. The **contact** is coordinated. That distinction is the
thing worth engineering.

---

## 14. Notifications

**Both the assigned manager and the principal**, as a **daily digest** — not
per-event. Per-event mail on arrears is how a mailbox gets filtered.

- One mail per person per day, only when there is something in it. Silence is the
  normal state for a healthy book and should stay silent.
- The manager gets their own leases. The principal gets everything, grouped by
  manager, because the principal's question is "is anyone letting one slip", not
  "who owes what".
- Where no manager is assigned, the principal is the manager.
- Cases sharing a tenant are grouped together, per section 13.
- Lapsed clocks first, and named in the subject line — the only genuinely urgent
  part.
- Locare-branded per agency, through the same email layer as the changelog.

---

## 15. TPN and credit-bureau listing

**In scope**, after the v1 core. It is a strong practical lever here — a tenant
who will not answer a call will answer a TPN listing — and agencies will ask for
it early.

It is also the part of this feature with the most compliance attached, so it is
built as a **stage with preconditions**, never a button:

- A listing needs a **lawful basis** and prior notice to the person, with a
  remedy window before it goes live. That notice, its delivery and its window are
  exactly the evidence chain in section 10, so the machinery already exists.
- The data is personal information under POPIA: the agency is the responsible
  party, Locare the operator. Retention and correction duties follow.
- A disputed or withheld amount must not be listed. A case flagged
  `possible_withholding` cannot reach this stage, on the same guard as section 7.

**Locare provides the record and the clock; the agency holds the TPN relationship
and makes the listing.** Same division as section 11 — Locare should not be the
party submitting a listing on an agency's behalf.

Confirm the notice period and the lawful basis with the attorney alongside
sections 8 and 11.

---

## 16. Prescription

A debt prescribes after three years, after which it cannot be enforced. Surface a
case at **2.5 years**, leaving time to act.

The subtlety that makes this worth building rather than guessing: the clock runs
from when the debt became due, but **it is interrupted by acknowledgement** — a
part payment, or a signed arrangement — and restarts from zero. So the warning is
computed from `last_acknowledged_at` (section 9), not from the oldest invoice
date.

Which means a chronic short-payer who pays something every month is almost never
near prescription, while a case that went quiet two years ago may be weeks from
it. Those are the ones nobody remembers, and they are exactly what an attention
engine is for.

---

## 17. Data model

    arrears_rules          one row per vendor; the section 3 numbers
    arrears_cases          lease_id, owner_id, shape, stage,
                           stage_entered_at, stage_due_at,
                           breach_notice_days, cpa_applies,
                           rent_arrears, fees, deposit_held,
                           possible_withholding, opened_reason,
                           paused_until, last_acknowledged_at,
                           closed_at, close_reason
    arrears_case_events    append-only: type, at, actor, payload, evidence
    arrears_arrangements   instalments, honoured/broken, linked case,
                           doubles as the acknowledgement record

`relatedCases` (section 13) is derived at read time from the lease's tenant, not
stored — it changes whenever another case opens or closes.

`opened_reason` is stored as **a sentence with the numbers in it** —

> Balance R4,312 is 0.54x monthly rent; short in 8 of the last 8 months;
> 2 failed debit orders.

— not a rule id. Six months later, in front of an attorney or a landlord, that
sentence is the whole point.

Events are append-only for the same reason the ledger is: this is the record
someone relies on after something has gone wrong.

---

## 18. Build order

1. `business-days.ts` + SA holiday table, with tests. Standalone, useful alone.
2. Case evaluation as a pure module — conditions in, `opened_reason` out. No DB.
3. Schema + the daily per-vendor evaluation job (BullMQ repeatable, same shape as
   the billing scheduler). A tenant who stops paying entirely generates no events,
   so evaluation must be scheduled, not event-driven.
4. The maintenance cross-check (section 6), including the `DunningService` guard.
5. The daily digest (section 14).
6. Stages, guards, evidence capture.
7. Arrangements, and with them `last_acknowledged_at` and the prescription
   warning.
8. The screen.
9. TPN listing as a stage (section 15), after the attorney review.

Steps 1-5 are worth shipping alone: they surface the invisible cases and tell
somebody about them, without committing to the process machinery or needing a
legal opinion first.

---

## 19. Decisions taken

Settled 2026-09-13:

- **Late fees stop** on a `possible_withholding` flag; past fees reversed only by
  a recorded human decision. (§4)
- **Both the manager and the principal** are notified, as a **daily digest**,
  only when there is something to say. (§14)
- **TPN and credit-bureau listing is in scope**, after v1, as a guarded stage
  with notice requirements — not a button. (§15)
- **Prescription surfaces at 2.5 years**, computed from last acknowledgement
  rather than from the oldest invoice. (§16)
- **One case per lease.** A tenant with two units in arrears has two cases,
  cross-referenced so the contact is coordinated. (§13)

Still open:

- Whether a manager can *snooze* a case without closing it. Useful, and also the
  obvious way for a case to be quietly buried.
- Whether the principal's digest includes what managers actioned that day, or
  only what is outstanding.
