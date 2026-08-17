# Locare — Partner Commission Structure

Status: **Approved — ready to publish, subject to §12.** Owner: Arthur.
Last updated: 2026-08-16.

The commission model for partners who bring agencies to Locare: three tiers,
rate rising with work transferred off Locare, paid on cash actually collected.

Supersedes the two drafts that preceded it — a four-tier rate ladder
(08/17/22/26) and a flat 26%-for-life with volume caps. §10 records why neither
was adopted.

> **Read §12 first.** This document is written as though every prerequisite is
> settled, so it can be published and built against. Six of those prerequisites
> are assumptions, not confirmed facts. §12 lists them. The first four are cheap
> to correct if wrong; assumption 5 is not, because lifetime rates cannot be
> reduced once granted.

---

## 1. The structure

| | **Introducer** | **Partner** | **Reseller** |
|---|---|---|---|
| **Rate** | 8% | 17% | 26% |
| **Term** | 24 months per agency | Lifetime | Lifetime |
| **They do** | Introduce | Introduce, demo, help onboard | Sell, onboard, first-line support |
| **Locare does** | Demo, close, onboard, support | Close, support | Back-stop only |
| **Qualifies on** | Registration + KYC/KYB | 2 agencies the partner demoed, **confirmed by Locare** | **R15,000/month collected** across referred agencies for 3 consecutive months, + signed Reseller Support Addendum |

Rate applies to the referred agency's recurring subscription revenue, excluding
VAT, for as long as that agency keeps paying.

### Qualification is on work done, not intent

Each rate is priced for work transferred off Locare, so each gate has to
measure that work rather than a proxy for it.

**Partner is granted on demos Locare witnessed.** An earlier draft qualified on
"2 active agencies **or** completed training". Training is attendance: a partner
could sit through a session, forward two emails, and hold 17% for life while
Locare still ran every demo and every onboarding. Training remains a
prerequisite for *running* demos — it is how a partner becomes competent to do
the work — but the tier is granted only when Locare has confirmed two of them.

**Reseller is gated on collected revenue, not agency count.** An earlier draft
said "5 active agencies", which the code counts with no reference to MRR. Five
of the smallest possible agencies — free, if Starter ever goes free — would have
bought 26% for life on every referral afterwards, including Scale at
R1,564/month. A rand threshold cannot be gamed with shells, and three
consecutive months stops a one-month spike from clearing it.

Both gates are admin actions against evidence, not automatic promotions.

---

## 2. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Model | **Tiered rate**, rising with work transferred off Locare. |
| 2 | Tier count | **Three.** |
| 3 | Rates | **8 / 17 / 26.** |
| 4 | Lifetime | **Earned, not given.** 24 months at Introducer; lifetime from Partner up. |
| 5 | Basis | **Cash collected**, not billed (§4). |
| 6 | Timing | Statement on the 7th, payout by the 15th, both for the prior month. |
| 7 | Minimum payout | **R250**, rolling over below that, swept quarterly regardless (§4.1). |
| 8 | Distributor / white-label | **Not a published tier.** Negotiated wholesale deal (§6). |
| 9 | Commissionable revenue | **Recurring subscription only**, ex-VAT. Once-off and pass-through excluded (§5.1). |
| 10 | Partner VAT | Rates are **VAT-exclusive**; Locare self-bills registered partners (§7.1). |
| 11 | Agency pricing | Published prices are **VAT-exclusive**; Dantalan grandfathered (§7.2). |
| 12 | Starter plan | **R925/month, paid.** The live site is the source of truth (§5). |
| 13 | Reseller support terms | **Separate addendum** (§6.1). |
| 14 | Tier qualification | **Measured work**: confirmed demos for Partner, collected MRR for Reseller (§1). |
| 15 | Self-dealing | **Not commissionable.** No commission on an agency under the partner's own control (§7.4). |
| 16 | Attribution mechanism | **Ref link or Locare-confirmed introduction**, with a cap on open leads (§7). |

---

## 3. Why the rates are what they are

**8% for an introduction.** Locare does everything; the partner made a call. On
Growth that is R213/month for one email — real money to them, cheap acquisition
for us.

**17% when they carry the demo and onboarding.** The first tier that saves
Locare actual hours. Slightly more than doubling the rate for meaningfully more
work is a clear, motivating jump rather than a marginal one.

**26% when they own first-line support.** A Reseller sells, onboards and
absorbs first-line support, so 26% buys both acquisition and an operating cost.

Be precise about which of those is doing the work, because an earlier draft of
this section was not. It claimed contribution per customer *improves* at this
tier because support is Locare's biggest cost of scale. That claim is not
supported by any number Locare has. 26% of Growth is R692/month; a 10–150 unit
agency is likely to generate one or two support tickets in a month, which does
not plausibly cost R692 to answer. On support economics alone, 26% probably
overpays.

The honest justification is that 26% buys **distribution** — a Reseller selling
under their own brand, at zero CAC to Locare, in a market Locare cannot cover
alone. That is worth paying for. Support absorption is a secondary benefit, not
the arithmetic that makes the rate work. Recorded as assumption 5 in §12; revisit
once there is real support-cost data.

### Lifetime is earned

Lifetime commission is irreversible. Rates can be lowered for new partners; they
cannot be lowered for existing ones without a fight we would lose. Committing to
lifetime at every rung — before a single agency has been billed and with no
churn data — would be a permanent decision made on nothing.

Reserving it also makes promotion genuinely attractive: reaching Partner does
not merely double the rate, it converts every future referral into an annuity.
That is a better motivator than the volume caps in the earlier draft, which told
productive referrers to stop referring.

---

## 4. Payment basis and timing

**Commission accrues only on payments actually received from the agency.**

| | |
|---|---|
| Agency billed | month N |
| Commission accrues on payments **received** in | month N |
| Statement issued | **7th** of month N+1 |
| Payout | by the **15th** of month N+1 |
| Below R250 | rolls to the next month, swept quarterly regardless (§4.1) |

### Why arrears, and why collected

An earlier draft billed on the 28th and paid out on the 8th — ten days, before
anyone knows whether the debit order bounced. Recovering money already paid to a
partner is the fastest way to poison a channel. Paying in arrears on collected
revenue means clawbacks never arise. It costs a few weeks of partner patience,
which is easy to explain up front and impossible to explain afterwards.

### 4.1 The minimum payout, and why it was lowered

A R500 floor looks like sensible admin hygiene until it is applied to the tier
most partners actually join at. An Introducer with one Starter agency earns
R74/month. At R500 their first payout arrives in **month seven**, and the whole
24-month term pays out in three lumps totalling about R1,776.

That is a recruitment problem disguised as a payments policy. Someone who
referred an agency in January and has seen nothing by June has concluded the
programme is not real, and they are not wrong to.

Two changes:

- **Floor drops to R250.** First payout for that same Introducer moves to month
  four.
- **Quarterly sweep.** Any balance above zero is paid at the end of March, June,
  September and December regardless of the floor. Nobody waits more than one
  quarter for money they have earned.

The floor exists to avoid R12 EFTs, not to hold partner money. A sweep keeps the
first purpose and drops the second.

### Required change: the accrual job

`CommissionsService.accrue()` currently selects from `vendor_subscriptions` on
`status IN ('active','trialing')` and `mrr > 0`, writing `basis_mrr` straight
from the subscription. As written it accrues on **subscribed MRR, including
trials** — a partner would earn on a trial that never converts and on an invoice
never paid.

Two changes, both required before the first partner is approved:

1. Accrue against payments received for the period, not `vs.mrr`.
2. Exclude `trialing`. Commission starts on the first collected payment.

---

## 5. Worked figures

Starter is a paid plan at **R925/month**. Prices below exclude VAT (§7.2), and
commission is calculated on these ex-VAT amounts.

| Plan | Fee (ex-VAT) | Introducer 8% | Partner 17% | Reseller 26% |
|---|---|---|---|---|
| Starter | R925 | R74 | R157 | R241 |
| Growth | R2,660 | R213 | R452 | R692 |
| Scale | R6,014 | R481 | R1,022 | R1,564 |

**Five Growth agencies as a Partner is R2,260/month, recurring.**

That is the headline for the intro pack. It is arithmetic on published prices
and must be presented as illustrative — Locare has no partners, no billing
history, and has never paid a commission. Nothing in partner-facing material may
imply earned results.

### 5.1 What is commissionable

**Recurring subscription revenue only, excluding VAT.**

Excluded: once-off onboarding and setup fees, data migration, training, custom
development, and any pass-through cost (SMS, WhatsApp, e-sign, payment gateway
fees).

Once-off fees mostly recover Locare's own labour at close to cost — paying 26%
of a migration fee means doing the migration at a loss. Pass-through costs are
not revenue at all; commissioning them would pay a partner a slice of a bill
Locare merely forwards. And VAT is never Locare's money to share.

For the partner terms:

> *Commission is calculated on recurring subscription fees actually received,
> excluding VAT. Once-off fees and pass-through costs are not commissionable.*

Partners rarely object once the reason is given. They do object to discovering
it on their first statement.

---

## 6. Distribution / white-label

Not a published tier.

If a partner wants territory, white-labelling and full customer ownership, that
is **wholesale**, not commission: they buy at a discount and set their own
price. Cleaner legally, cleaner commercially, and it avoids paying commission on
a customer Locare never sees. It is also inherently a negotiated arrangement —
publishing it as a rung invites people to aim at something we would structure
individually anyway.

Handle as "talk to us."

### 6.1 Reseller Support Addendum

A separate document, signed in addition to the partner terms and referenced from
the tier table.

Separate because it is the only tier with operational obligations running in the
other direction. The partner terms say what Locare owes a partner; this says
what a Reseller owes Locare's end customers, and it is the document pointed at
when an agency complains that nobody answered. Buried in a general agreement it
becomes unenforceable in practice and unreadable for the 90% of partners it does
not apply to.

Minimum contents:

- **Scope of first-line support** — what the Reseller handles, what escalates.
- **Response times** — in hours, with a timezone and a definition of a business day.
- **Escalation path** — how a ticket reaches Locare, and in what state.
- **What Locare provides** — back-stop support, training, documentation.
- **Customer communication** — whether the Reseller speaks as themselves or as
  the agency's provider, and what they may not promise on Locare's behalf.
- **Review and exit** — how performance is assessed, and what happens to the 26%
  if the addendum is terminated (§7, tier demotion).

Draft it when the first Reseller is in sight. Writing response times now, against
no real support volume, would produce numbers invented rather than observed.

---

## 7. Terms

**Commission stops when the agency stops paying.** Obvious internally, not to a
partner. State it in the terms and in the intro pack.

**Attribution.** First referral recorded wins, within a **90-day window** from
first contact. Attribution is established one of two ways only: the agency
arrives through the partner's referral link, or the partner registers a **named**
prospect — agency name and a contact — which Locare confirms is a genuine
introduction before it counts.

Self-declared first contact with no named prospect is not attribution. Without
that constraint a partner can register every agency in a metro and collect on
whichever one later signs organically, having done nothing. For the same reason
a partner may hold at most **20 open unconverted prospects** at a time; beyond
that, older ones expire. Lead registration is meant to prevent two partners
colliding on the same agency, not to let one partner reserve a market.

**Tier demotion.** If a Reseller stops meeting the support addendum, the rate
already earned on existing agencies is retained; the tier for *new* referrals
drops. Anything harsher makes the top tier too risky to accept.

**Partner termination.** Fraud or misrepresentation ends commission
immediately. Ordinary resignation retains lifetime commission on agencies
already referred and still paying — otherwise "lifetime" means nothing.

### 7.1 Partner VAT

**Rates are VAT-exclusive. Locare self-bills.**

South African VAT is **15%** (the 2025 increases to 15.5% and 16% were
withdrawn; Budget 2026 left the rate unchanged).

Partners split into two groups Locare cannot control:

- **VAT-registered** — compulsory above R1m turnover, voluntary above R50k. They
  charge VAT on commission. Locare pays commission + 15% and reclaims it as
  input tax. Net cost unchanged.
- **Not registered** — no VAT added. Locare pays the stated commission.

Quoting rates VAT-exclusive is what keeps these equivalent. An inclusive figure
would mean a registered partner earning ~13% less than an unregistered one for
identical work.

**Self-billing.** Under a written self-billing agreement, Locare issues the
monthly statement as a **recipient-created tax invoice** on the partner's
behalf. This is permitted in South Africa and standard for commission
programmes. Waiting for twenty part-time partners to each raise a correct tax
invoice before payout will not work, and an incorrect invoice puts the
input-tax claim at risk.

Statements must carry: Locare's VAT number, the partner's VAT number where
registered, a VAT line where applicable, and clear labelling as a self-billed
tax invoice.

### 7.2 Agency pricing and VAT

**Published prices are VAT-exclusive.** An agency on Growth pays R2,660 + R399
VAT = R3,059.

Standard for B2B software, and the right call here because the buyers are
businesses: any agency at Growth or Scale is almost certainly VAT-registered
(compulsory above R1m turnover) and reclaims it, so the real cost to them is
unchanged. Absorbing the VAT instead would cut Locare's net revenue by 15% —
R925 becoming R804 — to spare a cost most customers do not actually bear.

Two consequences:

- **The site must say "excl. VAT" on every price.** A quoted price that silently
  becomes 15% higher at invoice is the kind of thing that ends a sale.
- **Dantalan is grandfathered.** They signed at R925 with no VAT position
  stated. Honour that as VAT-inclusive for their current term rather than
  invoicing your only customer a surprise increase. Move them to the standard
  basis at renewal, with notice.

Commission is unaffected either way: it is always calculated on the ex-VAT
subscription amount, which is the published price under this model.

### 7.3 Where the VAT number goes

Once issued, in four places:

1. `deploy/.env.prod` as `VAT_NUMBER`, so generated documents read it rather
   than hard-coding it.
2. Agency invoices — a registered vendor must show its VAT number or the
   recipient cannot claim input tax.
3. Partner statements (§7.1).
4. Legal pages, alongside the registered entity name and company registration
   number outstanding for POPIA. One trip through those pages, not two.

### 7.4 No commission on your own agency

**A partner earns no commission on an agency they control.**

Nothing in the earlier draft prevented a partner from signing their own agency
through their own referral link. That is not an edge case: an agency principal
who joins the programme, reaches Reseller, and self-refers converts the
programme into a permanent 26% discount on their own subscription — and does so
without breaking a single stated rule. It would not be fraud under those terms.
It would be the terms working as written.

The exclusion covers the partner, any entity in which the partner or an
immediate family member is a director, member or beneficial owner, and any
agency under common control with one of those.

This is enforceable with data already collected. Partner KYB captures company
registration number and director identity; agency onboarding captures the same
for the vendor. Matching registration numbers, director ID numbers and banking
details across the two is a check that can run at approval time rather than a
clause nobody verifies.

Where a partner genuinely operates an agency and wants to use Locare, they pay
for it like any other customer. Their commission is for agencies they bring, not
the one they run.

---

## 8. Implementation

Already supported by existing fields:

- `partners.commission_rate` — 0.08 / 0.17 / 0.26, set on promotion.
- `partners.commission_months` — **24** for Introducer, **null** (lifetime) for
  Partner and Reseller. `withinWindow()` already honours it.
- Tier promotion is an admin action; no new rate-resolution logic needed. The
  §1 gates are evidence an admin checks, not thresholds the system enforces.

Already fixed — migration `1720000039000-PartnerAttributionIntegrity`:

- **`provision_agency()` no longer overwrites attribution.** It upserted
  `referred_by_partner_id` with `DO UPDATE`, so a second partner onboarding an
  existing agency silently took over someone else's lifetime commission. Now
  `DO NOTHING`, matching `signup_agency()` and the stated first-wins rule.
- **`approve_agency()` stamps `started_at` on activation.** The column defaults
  to `now()` at INSERT — for a referral signup, the moment the form is
  submitted, while the row is still `pending`. Since accrual only runs on
  `active`/`trialing`, an Introducer's 24-month window was being eaten by an
  approval delay they do not control. Guarded to the pending → active
  transition so re-approval cannot restart the clock.

Work required, in order:

1. **Accrue on collected payments, excluding trials** (§4). Blocks launch.
2. **`tier` on `partners`**, so portal and admin show the rung rather than
   inferring it from a rate.
3. **Ex-VAT basis** — ensure the accrual reads the ex-VAT subscription amount,
   not a VAT-inclusive total, once agency invoicing carries VAT.
4. **Minimum-payout roll-over at R250, plus the quarterly sweep** (§4.1).
5. **Attribution window** enforced at referral capture, with the 20-open-lead
   cap (§7).
6. **Self-billed tax invoice** as the statement format, with both VAT numbers.
7. **Self-dealing check at partner approval** (§7.4) — compare partner KYB
   company registration, director ID and banking details against the referred
   vendor's. A report for the admin to review is enough; it does not need to
   block automatically.
8. **Reseller gate reporting** — collected MRR per partner over a rolling three
   months, so the §1 threshold can be checked without a manual tally.

---

## 9. Launch checklist

- [ ] VAT number issued and placed in all four locations (§7.3)
- [ ] Site prices restated as "excl. VAT"; Dantalan grandfathering confirmed in writing
- [ ] Accrual job switched to collected payments, trials excluded (§4)
- [ ] Self-billing agreement wording approved by the accountant
- [ ] Partner terms updated: commissionable revenue, attribution, demotion, termination, **self-dealing exclusion (§7.4)**
- [ ] Statement format carries both VAT numbers and self-billed labelling
- [ ] Intro pack figures match §5 exactly
- [ ] Migration `1720000039000` run in production (attribution + activation clock)
- [ ] Payout floor set to R250 and the quarterly sweep scheduled (§4.1)
- [ ] Self-dealing check runs at partner approval (§7.4)
- [ ] First payout run rehearsed against test data before any real partner is approved

---

## 10. Rejected alternatives

**Flat 26% for life at every tier, with volume caps (8/17/22/26/62).** Pays
identically for radically different work — a forwarded email earns the same as a
partner who sells, onboards, supports and white-labels. The caps attempt to
correct this by limiting volume rather than rate, which means telling a
productive referrer to stop referring: the wrong lever, pointed the wrong way.
It is also more code than the tiered model, needing per-partner active-agency
counting and cap enforcement at referral time.

**Four-tier rate ladder (08/17/22/26).** Right shape, too many rungs. The rates
were kept; the fourth tier was not. A threshold of 12 active agencies is
unreachable at zero customers, and publishing unreachable tiers makes the
programme feel theoretical. T3 (22%) and T4 (26%) collapsed into a single
Reseller rung at 26%, with distribution moved to a negotiated wholesale deal
(§6).

---

## 11. Benchmark comparison

*Researched 2026-08-16.*

### 11.1 What could and could not be found

**No South African competitor publishes partner commission rates.** PayProp,
WeconnectU and the other SA property-software vendors have no public partner or
reseller rate card. Nothing below is a rate-versus-rate comparison against a
named competitor; it is Locare against **global B2B SaaS channel benchmarks**,
which is the best evidence available. Treat competitor rates as unknown until
someone states them directly.

Two structural notes from what the market does show:

- **PayProp monetises the payment flow**, not a per-seat subscription, so a
  percentage-of-subscription programme does not map onto their model. They are
  unlikely to compete with Locare on commission rate at all.
- **The SA channel pattern is integration partnerships**, not individual
  referrers — WeconnectU appears as a Netcash partner, for example. Recruiting
  individual introducers is closer to an open field than a contested one.

### 11.2 Locare against benchmark

| | Benchmark (2026) | Locare | |
|---|---|---|---|
| Referral / introducer | 10–15% | **8%** | Below |
| Median SaaS affiliate | 20% | **17%** | Slightly below |
| Reseller owning the relationship | 20–35% | **26%** | In range |
| Typical term | Fixed months, or 25–30% yr 1 then 5–8% renewals | **Lifetime from Partner up** | Well above |

**Locare is below benchmark on rate and well above it on duration.** That is the
right trade, but it means the headline percentage is the weaker half of the
pitch and the term is the stronger half. Partner-facing material should lead
with the term.

### 11.3 The trade, in rands

Cumulative commission per referred Growth agency (R31,920/year ex-VAT):

| | yr 1 | yr 2 | yr 3 | yr 5 |
|---|---|---|---|---|
| **Locare Partner** — 17% lifetime | R5,426 | R10,853 | R16,279 | R27,132 |
| Benchmark hybrid — 28% yr 1 + 6% renewals | R8,938 | R10,853 | R12,768 | R16,598 |
| **Locare Reseller** — 26% lifetime | R8,299 | R16,598 | R24,898 | R41,496 |
| Benchmark — 20% for first 12 months | R6,384 | R6,384 | R6,384 | R6,384 |
| Benchmark — 12% lifetime | R3,830 | R7,661 | R11,491 | R19,152 |

**Partner crosses the hybrid benchmark at exactly 24 months** — exactly, because
17% × 2 = 28% + 6% — and pays **63% more over five years**. Reseller beats every
benchmark shape outright.

The line for the intro pack, which is true and checkable:

> *Most programmes pay well in year one and almost nothing after. Ours pays the
> same every month for as long as the agency stays.*

### 11.4 Where Locare is exposed

**The Introducer tier is the weak one.** 8% for 24 months tops out at **R5,107**
per Growth agency and then stops. Against a competitor offering 12% lifetime,
Locare loses from year three (R11,491 against R5,107). It beats a
20%-for-12-months programme and beats 12%-for-12-months by a third — but it is
the tier most people will compare, because it is the one anyone can join today.

Two ways to close that gap if it starts costing recruits:

1. **Raise to 10%**, sitting at the bottom of benchmark.
2. **Extend to 36 months.** Cheaper than raising the rate, and it reinforces the
   "we pay longer" story rather than contradicting it.

Prefer (2). Do neither until there is evidence of partners declining over it.

### 11.5 The advantage that is not a rate

Locare's real channel differentiator is not 26%. It is that white-labelling plus
the per-agency merchant model lets a Reseller genuinely **own the customer under
their own brand**. Neither PayProp nor WeconnectU can offer that without
dismantling their own positioning.

That is worth more in a recruitment conversation than four percentage points,
and it should be the first thing said to a serious Reseller candidate.

---

## 12. Assumptions

This document reads as settled so it can be published and built against. These
four are assumptions, and each is listed with what changes if it is wrong.

| # | Assumed | If wrong |
|---|---------|----------|
| 1 | **Starter is paid at R925.** The live site is treated as the source of truth over `PARTNER_PORTAL_DESIGN.md` §4, which says free at MRR 0. | If Starter is free, the Starter column in §5 becomes R0 and Introducers earn nothing on the segment they can most easily reach. The tier model survives; the intro pack's Starter figures do not. |
| 2 | **VAT registration completes and the number is issued.** In progress at time of writing. | Until issued, Locare cannot charge VAT or reclaim input tax on commission to registered partners — at 26% on Growth, R692 becomes R796 all-in with R104 unrecoverable. Do not sign partners before the number lands. |
| 3 | **Published prices become VAT-exclusive** (§7.2). | If they are made inclusive instead, net revenue drops 15% (R925 → R804) and every commission figure in §5 falls with it. |
| 4 | **The accountant approves self-billing** as described in §7.1. | If not, partners must each raise their own tax invoice before payout, which is slower and more error-prone but does not change any rate. |
| 5 | **26% at Reseller clears contribution margin.** Justified as buying distribution, not as offsetting support cost (§3). Locare has no support-cost data and has never paid a commission. | If gross margin per agency is thinner than assumed, 26% is unaffordable — and being lifetime, it cannot be reduced for partners already on it. Re-check after six months of real support volume and before promoting the first Reseller. |
| 6 | **Partner-referred agencies churn no faster than direct ones.** | Lifetime commission on a high-churn cohort is self-limiting, so this is not a cost risk. It is a *forecasting* risk: referred MRR would be worth less than the same direct MRR, and channel payback would be longer than modelled. |

§7.2 (agency pricing) and this section are commercial recommendations, not
tax advice. Have the accountant confirm the VAT treatment and self-billing
wording before the first statement is issued.
