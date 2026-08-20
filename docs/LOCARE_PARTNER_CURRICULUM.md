# Locare Partner Curriculum

**Status:** Draft — not yet issued to any partner. Owner: Arthur.
Written 2026-08-20.

Training for people who sell Locare to South African rental agencies:
Introducers, Partners and Resellers.

Eight modules. Modules 1–4 are compulsory for everyone. Module 5 is the gate for
running your own demos, which is what promotes an Introducer to Partner. Modules
6–8 apply to Resellers. Each module ends in a knowledge check; the answers are in
Appendix B so this can be self-served now and turned into a graded assessment
later.

---

> ## Read this before anything else
>
> **Locare has no paying customers yet.** One agency is live (Dantalan). No
> partner has ever been approved, no commission has ever been paid, and no
> agency has ever been charged a subscription.
>
> Everything in this curriculum about earnings is arithmetic on published
> prices. None of it is a result anyone has achieved. If you repeat a number
> from Module 3 to a prospect, present it as what the programme pays, never as
> what partners earn.
>
> Module 8 covers this properly. It matters enough to appear twice.

---

## How the modules fit together

| # | Module | For | Why it exists |
|---|---|---|---|
| 1 | What Locare actually is | Everyone | You cannot sell what you cannot describe |
| 2 | Who to sell it to | Everyone | Most wasted effort is a wrong-fit prospect |
| 3 | Money: pricing, tiers, commission | Everyone | The part people get wrong on their first call |
| 4 | The portal: logging what you do | Everyone | Attribution is how you get paid |
| 5 | Demoing the product | Partner gate | Locare must witness two before promotion |
| 6 | Objections and competitors | Reseller | Where the deals are actually lost |
| 7 | Onboarding an agency | Reseller | The work the 26% is paying for |
| 8 | Compliance and what you may not say | Everyone | The module that protects you personally |

Modules 1–4 take about two hours. Module 5 is practice, not reading.

---

# Module 1 — What Locare actually is

## 1.1 The one-sentence version

> Locare is a white-label platform that runs a rental agency's whole
> operation — leasing, rent collection, trust accounting, owner payouts,
> maintenance — under **the agency's own brand and domain**.

The last part is the product. Everything else on that list exists elsewhere.

## 1.2 What white-label means here, concretely

An agency called Dantalan runs Locare at `app.dantalan.co.za` and
`rentals.dantalan.co.za`. Their tenants and landlords see Dantalan's logo,
Dantalan's colours, Dantalan's domain. Emails come from Dantalan.

**Their tenants and owners never see the name Locare.** That is not a
configuration option we happen to offer — it is the position the whole product
is built around. Branding resolves from the incoming domain on every request.

Why an agency principal cares: they spent years building a name in their suburb.
Software that puts a competitor's brand in front of their landlords is asking
them to rent their own customer relationship.

## 1.3 The part that is genuinely hard to copy

**The ledger is double-entry and immutable.**

Every invoice, payment, deposit, owner statement and payout posts through a
double-entry ledger. Nothing is ever edited. A correction is a new posting that
reverses the old one, so the history of what happened is permanent.

Say it to a principal like this:

> Every rand that moves through your agency leaves a permanent record. Nothing
> can be quietly changed after the fact — not by staff, not by us. When the PPRA
> asks you to account for a trust balance, the answer is in the system and it
> reconciles.

This is the thing to lead with for any agency that has been through an audit, or
has ever had a dispute with a landlord over a deposit. It is also true, which
matters, because it is checkable.

**Do not oversell this into a compliance guarantee.** See Module 8.1.

## 1.4 Tenant isolation

Each agency's data is fenced off inside the database itself, not by application
code remembering to filter. One agency cannot see another's tenants, leases or
money, and that is enforced a layer below anything a bug could reach.

Worth one sentence to a technical buyer or an IT-literate principal. Do not
volunteer a deeper explanation than that — if they push, escalate to Locare
rather than improvising.

## 1.5 The surfaces

| Surface | Who uses it | What they do |
|---|---|---|
| **Back-office** (web) | Agency staff | Properties, leasing, rent runs, owner payouts, reports, settings |
| **Tenant app** | Tenants | Pay rent, upload proof of payment, log maintenance, sign documents, message the agency |
| **Landlord app** | Property owners | Track properties, view statements, manage banking |
| **Owner portal** (web) | Property owners | The same, on a desktop |
| **Public rentals site** | The market | Branded listings, applications straight into the agency's pipeline |

### One honest caveat on the mobile apps

The tenant and landlord apps are currently **web apps**, not published in the
Apple App Store or Google Play. They work in a mobile browser and can be added
to a home screen.

Say "a mobile app your tenants open from your website." Do **not** say "available
on the App Store." An agency that discovers this after signing will not trust
the next thing you tell them.

## 1.6 What is not live yet

Be exact about this. As of 2026-08-20:

| Not yet live | What it means for a conversation |
|---|---|
| **No live card or EFT payment has been processed** | The rail is built and tested but no real money has moved. Do not describe payment collection as proven in production. |
| **Debit orders (DebiCheck)** | Mandate handling is built; collection submission is not finished. Do not promise a go-live date. |
| **WhatsApp notifications** | Built, switched off pending Meta approval. Everything falls back to email today. Do not demo it. |
| **Subscription billing** | No agency has ever been charged automatically. |
| **Google sign-in** | Brand verification not yet approved. |

If a prospect needs one of these on day one, say so and escalate. A deal you
delay by a month is worth more than one you lose in month two.

---

### Knowledge check — Module 1

1. In one sentence, what is Locare?
2. An agency principal asks: "will my landlords know I'm using someone else's
   software?" What do you say?
3. Why does the immutable ledger matter to an agency that has been audited?
4. A prospect asks whether their tenants can download the app from Google Play.
   What is the accurate answer?
5. Name two things that are built but not yet live in production.

---

# Module 2 — Who to sell it to

## 2.1 The shape of a good fit

**A South African rental agency, 15 to 400 units, with a principal who owns the
business and a brand they care about.**

Each part of that is doing work:

- **South African** — the product is built for POPIA, PPRA trust accounting,
  ZAR, `en-ZA` dates and SA banking. It is not a generic international tool.
- **15 to 400 units** — below about 12 units a spreadsheet still works and the
  subscription is a real cost. Above 400 you are into multi-branch, which is
  Scale or Custom and involves Locare directly.
- **Principal who owns the business** — they can sign. A branch manager at a
  national franchise cannot, and usually cannot change software at all.
- **Cares about their brand** — this is the qualifier most people skip. An
  agency indifferent to whose name their landlords see has no reason to prefer
  Locare over anything cheaper.

## 2.2 Buying triggers

The best prospects are not "unhappy with their software." They are:

- **Growing past their spreadsheet.** Usually 15–40 units, a principal doing
  rent runs manually on the 1st, one bookkeeper, and it has started breaking.
- **Just had a trust-account scare.** An audit query, a landlord dispute, a
  reconciliation nobody could explain. This prospect converts fastest and cares
  about Module 1.3.
- **Rebranding, or newly independent.** Someone who has just left a franchise
  and is building their own name. White-label is the entire pitch.
- **Losing landlords to bigger agencies over reporting.** They cannot show an
  owner a live statement; their competitor can.

## 2.3 Who to walk away from

Disqualify early. Time is the only thing you actually spend.

| Prospect | Why not |
|---|---|
| **Under ~10 units** | Subscription is a meaningful share of their revenue. They will churn. |
| **Sales-only estate agency** | Locare is rental management. Sales agencies have no rent to collect. |
| **Wants a free trial forever** | There is a paid model. Someone unwilling to pay at Starter will not pay later. |
| **Needs a feature that does not exist** | See Module 1.6. Escalate rather than promising a roadmap. |
| **Franchise branch without signing authority** | Escalate to Locare. Group deals are negotiated, not referred. |
| **Wants Locare to hold tenant money** | It never does. See Module 8.3. |

## 2.4 Where they are

- Agencies already running their own rentals site — visible, brand-conscious,
  and you can see their portfolio size.
- PPRA-registered practitioners in your own area. Local matters: an SA agency
  buys from someone who can meet them.
- Bookkeepers and accountants who do trust reconciliations for several agencies.
  One relationship, several introductions, and they carry credibility you do not.
- Anyone leaving a franchise. Watch for it.

## 2.5 The first conversation

You are qualifying, not selling. Four questions:

1. **How many units under management?** → tier, and whether they qualify at all
2. **Who does your rent run, and how long does it take?** → pain
3. **Whose brand do your landlords see when you email a statement?** → the
   white-label opening
4. **When last did a trust reconciliation take longer than it should have?** →
   the ledger opening

If the answers are good, book a demo. **Do not pitch price on the first call.**
Price without context is just a number to compare, and Module 3.4 explains why
the number in isolation is misleading.

---

### Knowledge check — Module 2

1. What unit range is the sweet spot, and why does it end where it does?
2. Why is "cares about their brand" a real qualifier and not a nice-to-have?
3. Give three reasons to disqualify a prospect on the first call.
4. A prospect manages 6 units and is keen. What do you do?
5. What are the four qualifying questions, and what does each one test?

---

# Module 3 — Money: pricing, tiers and commission

The module people skip and then get wrong in front of a prospect. Read it twice.

## 3.1 What the agency pays

Published on the live site. **All prices exclude VAT.**

| Plan | Units | Price / month (ex-VAT) |
|---|---|---|
| Starter | 1–12 | **R925** |
| Growth | 13–364 | **R2,660** |
| Scale | 365+ | **R6,014** |
| Custom | Bespoke | Talk to Locare |

Flat per band. Not per unit. An agency at 300 units and one at 20 both pay
R2,660, which is a genuinely good story for a growing agency — their cost does
not move as they win landlords.

VAT at 15% is added. Growth is R2,660 + R399 = **R3,059** on the invoice. Always
say "excluding VAT" out loud. A quoted price that grows 15% at invoice is how
deals die at the last step.

## 3.2 What you earn

| Tier | Rate | Term | You do | Locare does |
|---|---|---|---|---|
| **Introducer** | **8%** | 24 months per agency | Introduce | Demo, close, onboard, support |
| **Partner** | **17%** | Lifetime | Introduce, demo, help onboard | Close, support |
| **Reseller** | **26%** | Lifetime | Sell, onboard, first-line support | Back-stop only |

In rands per agency per month:

| Plan | Introducer 8% | Partner 17% | Reseller 26% |
|---|---|---|---|
| Starter R925 | R74 | R157 | R241 |
| Growth R2,660 | R213 | R452 | R692 |
| Scale R6,014 | R481 | R1,022 | R1,564 |

**Five Growth agencies as a Partner is R2,260 a month, recurring.**

That figure is arithmetic on published prices. It is not a result any partner
has achieved, because no partner has ever been paid. Present it as what the
structure pays, never as what people earn. Module 8.2.

## 3.3 How you move up

Neither promotion is automatic. Both are decisions Locare makes against
evidence.

**Introducer → Partner: two demos you ran, that Locare witnessed.**

Not two agencies signed. Not attendance at training. Locare has to have seen you
run two real demos to real prospects. Module 5 is how you get competent enough
to ask.

**Partner → Reseller: R15,000/month collected across your agencies, for three
consecutive months, plus a signed Reseller Support Addendum.**

Collected, not billed — money that actually arrived. Three consecutive months so
a single good month does not clear it. The addendum is a separate agreement
covering the first-line support obligation the 26% is paying for.

Roughly six Growth agencies paying reliably.

## 3.4 The number that gets partners in trouble

**The Locare subscription is not the agency's total cost of collecting rent.**

Once an agency collects by debit order, they hold their own facility with a
collection bureau and **pay that bureau directly**. Locare never touches it and
earns nothing from it. Indicative bureau costs, ex-VAT: roughly R419–R759 a
month for the facility, about R349 once-off vetting, and R3.62–R5.70 per
collection depending on volume.

What that does to the real bill:

| Agency | Locare | Bureau | Combined |
|---|---|---|---|
| Starter, 8 units | R925 | ~R465 | ~R1,390 |
| Growth, 60 units | R2,660 | ~R761 | ~R3,421 |
| Growth, 200 units | R2,660 | ~R1,899 | ~R4,559 |
| Scale, 500 units | R6,014 | ~R3,009 | ~R9,023 |

At 200 units the bureau is **42% of what the agency spends.**

So: never say "Locare costs R2,660 a month" as though that is the cost of
running rent collection. Say **"Locare is R2,660 a month excluding VAT. You'll
also hold your own debit-order facility with a bureau and pay them directly —
budget roughly R700 to R1,900 a month depending on volume."**

You lose nothing by saying it. You lose the deal and your credibility if they
find out at the first invoice. The bureau figures are indicative and not
Locare's to quote as a price — flag them as approximate and let the agency get
their own quote.

## 3.5 What commission is calculated on

**Recurring subscription fees actually received, excluding VAT.**

Not commissionable:

- once-off onboarding, setup, migration, training, custom development
- pass-through costs — SMS, WhatsApp, e-signature, payment gateway fees
- VAT

Once-off fees mostly recover Locare's own labour at close to cost; paying 26% of
a migration fee means doing the migration at a loss. Pass-through costs are not
revenue at all. VAT was never Locare's money to share.

## 3.6 When you get paid

| | |
|---|---|
| Agency pays Locare | month N |
| Your commission accrues | month N — **on money actually received** |
| Statement | **7th** of month N+1 |
| Payout | by the **15th** of month N+1 |
| Balance under **R250** | rolls over |
| Quarterly sweep | the payout runs **in March, June, September and December** release everything above zero, floor or not |

**Accrual is on cash collected, not on what was invoiced.** If an agency's
payment fails, no commission accrues that month. This is deliberate: it means
Locare never has to claw money back from you. Nothing is more corrosive to a
channel than a partner being asked to return money they have already spent.

The floor exists to avoid R12 EFT fees, not to hold your money — hence the
sweep. Nobody waits more than one quarter.

**Commission stops when the agency stops paying.** It is a share of revenue,
so no revenue means no share.

## 3.7 VAT on your commission

Rates are **VAT-exclusive**.

- **VAT-registered partner** — you charge VAT on commission. Locare pays your
  commission plus 15% and reclaims it. You are not out of pocket.
- **Not registered** — you receive the stated rate.

Quoting rates ex-VAT is what keeps these two equivalent. Locare will issue your
monthly statement as a self-billed tax invoice under a written agreement, so you
do not have to raise one yourself.

> **Not yet in force.** Locare's own VAT registration is still in progress. No
> partner can be approved until the number is issued. If you are reading this as
> a prospective partner, that is the current blocker.

## 3.8 How Locare compares

No South African competitor publishes partner commission rates, so this is
Locare against global B2B SaaS channel benchmarks, not against a named rival.

| | Typical market | Locare |
|---|---|---|
| Referral / introducer | 10–15% | **8%** |
| Affiliate median | 20% | **17%** |
| Reseller owning the relationship | 20–35% | **26%** |
| Term | Fixed months, or high year 1 then 5–8% | **Lifetime from Partner up** |

**Locare is below market on rate and well above it on duration.** Lead with the
term, not the percentage:

> Most programmes pay well in year one and almost nothing after. Ours pays the
> same every month for as long as the agency stays.

Per Growth agency, cumulative: a Partner at 17% lifetime overtakes a typical
"28% year one then 6%" programme at exactly 24 months, and is about 63% ahead
over five years.

Know the weak spot honestly. **The Introducer tier is the least competitive** —
8% for 24 months, then it stops. Against a hypothetical 12%-lifetime competitor
you would be behind from year three. That is precisely why the promotion path in
3.3 exists, and why almost nobody should plan to stay an Introducer.

---

### Knowledge check — Module 3

1. What does a 200-unit agency pay Locare per month, including VAT?
2. What else does that agency pay, to whom, and roughly how much?
3. Exactly what has to happen before an Introducer becomes a Partner?
4. An agency's February payment bounces and is paid in March. Which month does
   your commission accrue in, and why is that better for you than the
   alternative?
5. You have R180 accrued in October. When do you see it?
6. Why does Locare lead with the term rather than the percentage?

---

# Module 4 — The portal: logging what you do

Attribution is how you get paid. Everything in this module is mechanical, and
getting it wrong costs you real money.

## 4.1 Two ways an agency becomes yours

**Only two.** There is no third.

1. **Your referral link.** The agency signs up through your unique link. This is
   automatic, unambiguous and the one to prefer. Send the link.
2. **A named registered prospect.** You log the agency in your pipeline with an
   agency name and a named contact, and Locare confirms it is a genuine
   introduction before it counts.

**Saying you spoke to them first is not attribution.** Without the named-prospect
requirement a partner could register every agency in a city and collect on
whichever one later signed on its own. The rule is there to stop two partners
colliding over the same agency — not to let one reserve a market.

## 4.2 First recorded wins, inside 90 days

First referral recorded wins, within a 90-day window from first contact.
Attribution is set once when the agency is created and never changes afterwards,
so there is nothing to dispute later.

Practical consequence: **log the prospect the day you speak to them.** Not the
day they show interest.

## 4.3 The 20-open-lead cap

You may hold at most **20 open, unconverted prospects** at a time. Past that,
the portal refuses new ones until you close or lose some. Older leads expire.

Agencies arriving through your referral link are exempt — those are conversions,
not reservations.

Twenty is far more than anyone genuinely working a pipeline holds at once. If
you are hitting the cap, you are registering leads you are not working.

## 4.4 The pipeline

Seven stages: **Lead → Contacted → Demo → Trial → Proposal → Won → Lost.**

The first five are "open" and count toward your cap. Total Pipeline Value is the
sum of expected monthly subscription across your open deals.

- **Won** links the deal to the created agency. Commission takes over from there
  on that agency's actual payments.
- **Lost** asks for a reason. Fill it in honestly — it is the only data anyone
  has about why deals fail, and it feeds back into this curriculum.

Log calls, emails, demos and notes as activities. It is not busywork: activity
is the evidence behind a Partner promotion (Module 3.3) and it is what powers
the leaderboard.

## 4.5 What you can and cannot see

You see your agencies' **names, tier, unit count, subscription and status**.

You never see inside an agency: no tenants, no leases, no financials, no
landlord details. Not restricted by policy — not available to your login at all.

Say this plainly to a prospect who asks. "My access shows me that you're a
customer and what plan you're on. I cannot see your tenants or your money." It
is a stronger answer than any assurance, and it is true.

The leaderboard shows other partners' display names, headline metric, rank and
streak. Never their pipeline, their contacts or their banking.

## 4.6 Getting approved in the first place

Partners are vetted before they get a login — you earn commission and receive
payouts, so identity and banking are verified first (FICA and POPIA).

Apply at `app.locare.co.za/partner-apply`, as an individual or a business.

| | Individual | Business |
|---|---|---|
| Identity | ID or passport | Company registration (CIPC) + each director's ID |
| Address | Proof of address | Proof of business address |
| Banking | Bank confirmation letter | Bank confirmation letter |
| VAT | — | VAT certificate if registered |

Review is manual. Outcomes are approve, reject, or a request for more
information. Nothing is provisioned until you pass. Your ID number, directors'
ID numbers and banking details are encrypted at rest and masked even in admin
views.

## 4.7 You cannot earn commission on your own agency

**No commission is payable on an agency you control.**

This covers you, any entity where you or an immediate family member is a
director, member or beneficial owner, and any agency under common control with
one of those.

Why it exists: without it, an agency principal could join the programme, reach
Reseller, refer their own agency, and turn the partner programme into a
permanent 26% discount on their own subscription — without breaking any stated
rule.

It is checked automatically at approval and at accrual. A match between your
contact email and an owner of a referred agency is treated as conclusive and the
commission is withheld. Weaker signals — shared phone, similar company names —
are flagged for a human.

If you run an agency and want to use Locare, you are welcome to. You pay for it
like any other customer. Your commission is for agencies you bring, not the one
you run.

---

### Knowledge check — Module 4

1. What are the only two ways an agency is attributed to you?
2. You met an agency in January and logged them in May; another partner logged
   them in February. Who earns?
3. Why are referral-link signups exempt from the open-lead cap?
4. A prospect asks whether you can see their tenants' details. What is the
   accurate answer?
5. You are a director of a small agency and want to move it onto Locare. What
   commission do you earn on it?

---

# Module 5 — Demoing the product

**This module is the Partner gate.** Two demos Locare witnesses, and the 8%
becomes 17% for life. Nothing else in this curriculum has a better return on an
afternoon.

Reading it is not enough. Book practice runs with Locare.

## 5.1 Set up before you start

Use the demo agency, never a real one. You have no access to a live agency's
data and must never ask for it.

Have ready: the back-office, the tenant app, and the branded public rentals site
in three tabs. Know the login flow — it is passwordless, a one-time code by
email, and it surprises people if you are not ready to explain it.

## 5.2 The running order

Twenty minutes. Follow the money, because that is what a principal cares about.

**1. Their brand, first (2 min).**
Open the branded rentals site and the back-office side by side. Do not explain —
let them notice the logo and the domain. Then say: *"This is what your landlords
and tenants see. Your name, your domain. Locare is not on it anywhere."*

Lead here. It is the differentiator and it lands before anyone is bored.

**2. A lease becomes an invoice (4 min).**
Show an active lease, then the invoice it generated. Point out the rent run is
automatic on a schedule, not a person on the 1st of the month.

Ask: *"How long does your rent run take you now?"* Let them answer. The number
is usually embarrassing and they will say it out loud themselves.

**3. Money arrives and reconciles (4 min).**
Show a payment against an invoice, then a partly-paid and an overdue one. Show
the tenant-side proof-of-payment upload and the staff review queue.

Be accurate: automatic collection is built but **no live payment has been
processed yet** (Module 1.6). What you are showing is real product, not a
production track record. If they ask directly, say so.

**4. The ledger (3 min).**
Everything posted, nothing edited, corrections as reversing entries. This is the
moment for an agency that has been through an audit.

*"Every rand leaves a permanent record. A correction is a new entry, not a
change to an old one. When someone asks you to account for a trust balance, it
reconciles."*

**5. The owner's view (4 min).**
Owner statement, then the landlord app. This is the emotional one — most
principals are manually assembling statements in a spreadsheet and emailing PDFs.

*"Your landlord opens this themselves, whenever they want, and stops phoning you
on the 3rd."*

**6. Maintenance (2 min).**
Tenant logs a job with a photo; it appears as a work order routed to a service
provider. Quick — it is a nice-to-have, not a decision driver.

**7. Stop.** Do not tour the settings. Ask what they want to see again.

## 5.3 What not to do

- **Do not demo WhatsApp notifications.** Switched off. Email fallback only.
- **Do not open a real agency's data.** You do not have access and must never ask.
- **Do not promise a feature you did not just show.** Write it down, escalate,
  come back with an answer. "I'll find out" costs you nothing; being wrong costs
  the deal.
- **Do not demo the mobile apps as store-installed apps.** They are web apps
  (Module 1.5).
- **Do not talk price during the demo.** Price after value, and with Module 3.4's
  full picture.

## 5.4 What good looks like

The two demos Locare signs off on need:

1. Brand shown first, and the prospect visibly registering it
2. The money path walked end to end — lease, invoice, payment, ledger, owner
   statement
3. At least one question answered with "I don't know, I'll find out"
4. No claim made that Module 1.6 or Module 8 contradicts
5. A next step agreed before the call ends

Point 3 is not a joke. A partner who has never said it is a partner who is
guessing in front of prospects.

---

### Knowledge check — Module 5

1. What do you show first, and why?
2. A prospect asks during the demo whether tenants can pay by debit order today.
   What is the accurate answer?
3. Name three things you must not do in a demo.
4. Why is "I don't know, I'll find out" a requirement rather than a weakness?
5. What are the five things Locare looks for when signing off a demo?

---

# Module 6 — Objections and competitors

## 6.1 What is actually known about competitors

Be careful here. **No South African competitor publishes partner rates**, and
Locare has not run a feature-by-feature comparison against a named rival that
would survive being quoted back.

Two things that are known and safe to say:

- **PayProp monetises the payment flow** rather than charging a per-seat
  subscription. Different model. Not a like-for-like price comparison, and do
  not attempt one.
- **The SA channel pattern is integration partnerships** — WeconnectU appears as
  a Netcash partner, for example — rather than individual referrers. Recruiting
  individual partners is closer to an open field than a contested one.

**Do not make specific claims about a competitor's features, pricing or
reliability.** You will eventually be wrong in front of someone who knows
better, and a disparaging claim you cannot substantiate is a legal problem, not
just an awkward moment.

Compete on what Locare does, which you can demonstrate:

> I can't speak to what they charge or what they've built. What I can show you
> is that your landlords will only ever see your brand, and that every rand
> reconciles permanently.

## 6.2 The objections you will actually hear

**"We're already on something else."**
Good — they have accepted that software is necessary and you can skip that
argument. Ask what their landlords see when a statement goes out, and how long
their last trust reconciliation took. If both answers are comfortable, they are
not a prospect today. Log it as Lost with the real reason and move on.

**"That's expensive."**
Reframe to time, not features. A principal spending a day a month on the rent
run and half a day assembling owner statements is spending more than R2,660 of
their own time. Then be straight about Module 3.4 — the bureau cost too. Being
the person who volunteered the full number is worth more than the discount you
did not have authority to give anyway.

**"We're too small."**
Under about 10 units they are right, and you should say so (Module 2.3). At
15–40 they are exactly the target: growing past the spreadsheet, and Starter at
R925 covers it.

**"What happens to my data if you disappear?"**
Fair, and the honest answer is better than a reassuring one. Their data is
theirs, it is exportable, and reports come out as CSV. Do not invent an escrow
arrangement or a guarantee that does not exist. If they need contractual
comfort, escalate — that is a Locare conversation.

**"Can you handle our trust account?"**
Careful. Locare provides trust accounting and an immutable ledger that makes
reconciliation and audit straightforward. **Locare does not hold their money and
is not their accountant.** The agency's own trust account, its PPRA obligations
and its auditor are unchanged. Module 8.1.

**"Can we try it free?"**
There is no free tier. Starter is R925. What you can offer is a demo and a
guided onboarding conversation. Someone who will not pay R925 to solve the
problem they just described does not have the problem they described.

**"Who else uses it?"**
The hardest one, and the one where you must not improvise. One agency is live.
There is no roster of reference customers and inventing social proof is
misrepresentation (Module 8.2).

> You'd be early. One agency is running on it today. What I can do is show you
> exactly how it works and put you in front of the person who built it.

Being early is a real objection for some buyers and they will disqualify
themselves. That is fine. The alternative is a customer who signed on a false
impression and leaves noisily.

## 6.3 When to escalate rather than answer

Escalate — do not improvise — on:

- multi-branch, franchise or group deals
- anything about data escrow, SLAs, uptime guarantees or contractual liability
- integrations with a specific accounting package
- any request for a feature you have not seen
- anything about security architecture beyond Module 1.4
- any question touching legal or tax advice

"Let me get you a proper answer rather than a quick one" has never lost a deal.

---

### Knowledge check — Module 6

1. Why should you avoid comparing Locare's features to a named competitor?
2. A prospect says R2,660 is expensive. What two things do you do?
3. What is the accurate answer to "can you handle our trust account"?
4. A prospect asks who else uses Locare. What do you say?
5. List four things you escalate rather than answer.

---

# Module 7 — Onboarding an agency

For Resellers, and for Partners helping with onboarding. This is the work the
26% pays for.

## 7.1 Before anything technical

Confirm, in writing:

- **The legal entity and who signs.** Not the trading name.
- **Their VAT position.** They are invoiced ex-VAT plus 15%.
- **Unit count**, which sets the band. Be honest — a 13th unit moves them from
  R925 to R2,660 and they should hear that from you, now, not from an invoice.
- **The domain** they want their branded site on, and who controls its DNS.
  This is the single most common delay. The person who can change DNS records is
  often not the person you are talking to.
- **Their collection intention.** If they want debit orders, they need their own
  bureau facility (Module 3.4) and that has its own application and vetting
  timeline, run by the bureau, not by Locare.

## 7.2 Brand setup

Logo, colours, domain. Two practical notes:

- The email logo must be a **PNG or JPG served over HTTPS**. SVG does not render
  in email clients and will silently fall back.
- The domain has to point at Locare before anything is branded. Start the DNS
  conversation on day one.

## 7.3 Data

Properties, units, owners, tenants, active leases with their real start dates
and escalation terms. Opening balances matter — a lease imported without its
history produces a ledger that starts from nowhere.

Migration is a once-off service. It is **not commissionable** (Module 3.5), and
you should price your own time accordingly if you are doing it.

## 7.4 People

Every login is passwordless — a one-time code by email. Tell staff before their
first login or you will field confused calls.

Roles are baked in at sign-in, so a role change needs the person to sign out and
back in. This looks like a bug if you are not expecting it.

Three role-based manuals already exist — staff, tenant app, landlord app. Hand
them over rather than re-explaining.

## 7.5 The first rent run

Watch it. Do not assume it.

Check invoices generated for every active lease, the amounts match, the ledger
balances, and one owner statement is correct end to end. Finding a wrong
escalation date in month one is a conversation; finding it in month four is a
credibility problem.

## 7.6 First-line support (Resellers)

The 26% buys first-line support, governed by a signed Reseller Support Addendum
covering scope, response times, escalation path and what you may not promise on
Locare's behalf.

That addendum is **not yet written** — it will be drafted when the first Reseller
is in sight, with response times based on observed support volume rather than
invented ones. Do not assume its terms.

Broadly: you handle "how do I", configuration, training and triage. You escalate
anything touching money movement, data integrity, security or a suspected
defect. **Never promise a fix or a date on Locare's behalf.**

---

### Knowledge check — Module 7

1. What is the most common cause of onboarding delay, and how do you prevent it?
2. An agency has 12 units and is adding one next month. What must you tell them?
3. Why must the email logo be a PNG rather than an SVG?
4. Is migration work commissionable?
5. What do you check after the first rent run?

---

# Module 8 — Compliance and what you may not say

The module that protects you personally. A partner making claims Locare cannot
support creates a problem for the agency, for Locare, and for you.

## 8.1 Trust accounting and the PPRA

Locare provides trust accounting features and an immutable ledger. That helps an
agency meet its obligations. It does not discharge them.

**Never say:**

- "Locare makes you PPRA compliant"
- "You won't need an audit"
- "This is approved by the PPRA"
- "Locare guarantees your trust account is correct"

**Do say:**

- "Locare gives you a permanent, reconcilable record of every transaction, which
  is what your auditor and the PPRA will ask you to produce."

The agency remains responsible for its trust account, its Fidelity Fund
Certificate and its audit. Locare is software.

## 8.2 Never imply results nobody has achieved

No partner has been paid. One agency is live. No agency has been charged a
subscription automatically. No live payment has been processed.

**Never say:** "our partners earn R20k a month", "agencies save 40% on admin",
"hundreds of agencies use Locare", or name a customer who has not agreed to be
named.

**Do say:** "the programme pays 17% of subscription for as long as the agency
stays — on Growth that's R452 a month per agency."

The difference is between describing a structure and inventing a track record.
One is a fact about the terms; the other is misrepresentation.

## 8.3 Locare never holds tenant money

Rent flows to **the agency's own account**, through **the agency's own** payment
facility or bureau. Locare is not a bank, not a payment institution, and is not
registered as a financial services provider.

Never describe Locare as handling, holding or safeguarding anyone's money. If a
prospect wants Locare to hold funds, the answer is no, and it is architectural
rather than a policy that might change.

## 8.4 POPIA

You will handle personal information — prospect contacts, and your own KYC
documents.

- Collect only what you need for the introduction: agency name, contact name,
  contact details.
- **Do not collect or accept tenant or landlord personal information.** You have
  no lawful basis for it and no need for it. If an agency sends you a tenant
  list, do not open it — tell them to load it themselves during onboarding.
- Do not keep prospect data in personal spreadsheets or your phone's notes. It
  goes in the portal, which is access-controlled and auditable.
- Your own KYC data is encrypted at rest and masked in admin views.

Locare's own legal pages are still missing the registered entity name and company
registration number, which POPIA requires before taking a paying customer. **This
is outstanding**, and it is one reason no partner has been approved yet.

## 8.5 No financial, legal or tax advice

You are not the agency's accountant, auditor, attorney or tax adviser.

Do not advise on trust account structure, VAT treatment, whether to register for
VAT, tax deductibility, or the interpretation of a lease or the Rental Housing
Act. Refer them to their own professional. This applies to your own commission
too — Module 3.7 describes how the programme works, not what you should do about
your tax affairs.

## 8.6 What you may not promise on Locare's behalf

- a feature, a release, or a date
- a price, discount or contract term that is not published
- an uptime, SLA or response-time commitment
- data escrow, indemnity or liability terms
- that a competitor's product is worse

All of these are escalations. None of them will be held against you.

## 8.7 What ends a partnership

Fraud or misrepresentation ends commission immediately, including on agencies
already referred.

Ordinary resignation does not. Lifetime commission on agencies already referred
and still paying is retained — otherwise "lifetime" would mean nothing.

Tier demotion is gentler: a Reseller who stops meeting the support addendum
keeps the rate already earned on existing agencies, and drops a tier for new
referrals only.

---

### Knowledge check — Module 8

1. Rewrite "Locare makes you PPRA compliant" so it is accurate.
2. Why can you not say "our partners earn R20,000 a month"?
3. An agency emails you a spreadsheet of their tenants. What do you do?
4. A prospect asks whether Locare holds the rent. Answer them.
5. What is the difference between misrepresentation and resignation, in terms of
   what happens to your commission?

---

# Appendix A — One-page field reference

**Prices, ex-VAT, per month**
Starter (1–12 units) R925 · Growth (13–364) R2,660 · Scale (365+) R6,014 ·
Custom by arrangement. Add 15% VAT.

**Plus the agency's own bureau cost** — roughly R700–R1,900/month at Growth
volumes, paid directly to the bureau. Not Locare's, and not optional to mention.

**Commission**
Introducer 8% / 24 months · Partner 17% / lifetime · Reseller 26% / lifetime.
On recurring subscription actually received, ex-VAT.

**Per agency, per month**

| | 8% | 17% | 26% |
|---|---|---|---|
| Starter | R74 | R157 | R241 |
| Growth | R213 | R452 | R692 |
| Scale | R481 | R1,022 | R1,564 |

**Promotion**
→ Partner: 2 demos you ran, witnessed by Locare.
→ Reseller: R15,000/month collected, 3 consecutive months, + signed addendum.

**Payment**
Statement on the 7th, paid by the 15th, for the prior month. Under R250 rolls
over. Swept every March, June, September, December.

**Attribution**
Referral link, or a named prospect Locare confirms. First recorded wins, 90-day
window. Max 20 open leads. Nothing on an agency you control.

**Pipeline**
Lead → Contacted → Demo → Trial → Proposal → Won → Lost.

**Never say**
PPRA compliant · no audit needed · partners earn R… · hundreds of agencies ·
Locare holds the rent · a competitor is worse · any date, SLA or discount.

**Always say**
Excluding VAT · you'll also pay a bureau directly · one agency is live today ·
I'll find out.

---

# Appendix B — Knowledge check answers

**Module 1.** (1) A white-label platform running a rental agency's whole
operation under their own brand and domain. (2) No — tenants and landlords see
only the agency's brand and domain; Locare appears nowhere. (3) Nothing can be
edited after the fact, so trust balances reconcile permanently and a correction
is visible as a reversing entry. (4) Not currently — they are web apps opened
from the agency's site and added to a home screen; they are not in the app
stores. (5) Any two of: live payment processing, DebiCheck collection
submission, WhatsApp notifications, automatic subscription billing, Google
sign-in.

**Module 2.** (1) 15–400 units; below ~12 a spreadsheet still works and the fee
bites, above 400 it is multi-branch and involves Locare directly. (2) An agency
indifferent to whose brand its landlords see has no reason to prefer Locare over
something cheaper — white-label is the differentiator. (3) Any three of: under
10 units, sales-only agency, wants free forever, needs a feature that does not
exist, no signing authority, wants Locare to hold money. (4) Tell them honestly
they are below the useful range today, and stay in touch — they may be a
prospect at 15. (5) Unit count → tier and qualification; rent run duration →
pain; whose brand on statements → white-label opening; last trust reconciliation
→ ledger opening.

**Module 3.** (1) 200 units is Growth: R2,660 + R399 VAT = R3,059. (2) A
collection bureau, directly, roughly R1,900/month at that volume — around 42% of
their combined spend. (3) Two demos the partner ran, witnessed and confirmed by
Locare. Not signings, not attendance. (4) March, because accrual is on cash
collected. It is better because commission is never paid on money that did not
arrive, so it is never clawed back from you. (5) It is under the R250 floor, so the
mid-November run holds it. The next run is the December one — a sweep month — so
it is released by **15 December**.
(6) Locare is below market on rate and well above it on duration, so the term is
the stronger half of the pitch.

**Module 4.** (1) Your referral link, or a named registered prospect Locare
confirms. (2) The other partner — first recorded wins, and self-declared first
contact is not attribution. (3) They are conversions, not reservations; the cap
exists to stop leads being reserved, not to limit real signings. (4) No — you
see agency name, tier, unit count, subscription and status only; tenant and
financial data is not available to your login at all. (5) None. No commission is
payable on an agency you control; you pay for it as a normal customer.

**Module 5.** (1) Their brand — the branded rentals site — because it is the
differentiator and it lands before attention drops. (2) That collection is built
and tested but no live payment has been processed yet, and DebiCheck submission
is not finished. Offer to get a date rather than inventing one. (3) Any three
of: demo WhatsApp, open real agency data, promise unseen features, present the
mobile apps as store-installed, talk price during the demo. (4) Because a
partner who has never said it is guessing in front of prospects, and a wrong
answer costs more than a delayed one. (5) Brand first; the money path end to
end; at least one "I'll find out"; no claim contradicting Modules 1.6 or 8; an
agreed next step.

**Module 6.** (1) Because no rate or feature comparison has been verified,
you will eventually be wrong in front of someone who knows better, and an
unsubstantiated disparaging claim is a legal risk. (2) Reframe to the principal's
own time cost, then volunteer the full cost picture including the bureau. (3)
Locare provides trust accounting and an immutable ledger that make reconciliation
and audit straightforward; the agency's trust account, PPRA obligations and
auditor are unchanged, and Locare never holds their money. (4) That they would be
early — one agency is live — and offer a demo plus direct access to the person
who built it. Never invent customers. (5) Any four of: group deals, escrow/SLA/
liability, specific integrations, unseen features, deep security questions,
legal or tax advice.

**Module 7.** (1) DNS — the person who controls the domain is often not the
person in the room; start that conversation on day one. (2) That 13 units moves
them from R925 to R2,660, before they see it on an invoice. (3) Email clients do
not render SVG; it will silently fall back. (4) No — once-off fees including
migration are excluded. (5) Invoices for every active lease, correct amounts, a
balanced ledger, and one owner statement correct end to end.

**Module 8.** (1) "Locare gives you a permanent, reconcilable record of every
transaction — what your auditor and the PPRA will ask you to produce." (2) No
partner has ever been paid; it invents a track record that does not exist. (3)
Do not open it. Tell them to load it themselves during onboarding — you have no
lawful basis to hold tenant data. (4) No. Rent goes to the agency's own account
through the agency's own facility; Locare is not a bank or an FSP and never
holds funds. (5) Fraud or misrepresentation ends commission immediately,
including on existing agencies; resignation retains lifetime commission on
agencies already referred and still paying.

---

# Appendix C — Before this is issued

This curriculum is written from `LOCARE_COMMISSION_STRUCTURE.md`,
`PARTNER_PORTAL_DESIGN.md`, `LOCARE_PARTNER_KYC_DESIGN.md` and the live
marketing site. Six things must be settled before it goes to a real partner.

1. **VAT number issued.** No partner can be approved without it
   (commission structure §12, assumption 2). Module 3.7 says so explicitly, but
   the whole document assumes the programme can actually run.
2. **Legal pages carry the registered entity and company registration number.**
   POPIA requires an identifiable responsible party before taking a paying
   customer. Module 8.4 names this as outstanding.
3. **Partner terms updated** to match Modules 3 and 4 — commissionable revenue,
   attribution and the open-lead cap, tier demotion, termination, and the
   self-dealing exclusion. A curriculum that is stricter than the signed terms is
   worth nothing.
4. **Reseller Support Addendum drafted** (Module 7.6), or Module 7.6 stays
   explicitly marked as not-yet-written, which it currently is.
5. **The site must actually say "excl. VAT".** It currently does not — the
   pricing section shows "R2,660 / month" with no qualifier anywhere on the
   page. Module 3.1 trains partners to say "excluding VAT" out loud, which is
   right, but it puts them in the position of adding 15% to a number the
   prospect just read unqualified on Locare's own website. That is the exact
   last-step objection §7.2 of the commission structure wants to avoid, and it
   is a one-line fix on the marketing site.
6. **Bureau figures confirmed.** Module 3.4 uses Direct Debit's 2026-08-19 EFT
   price sheet, which is indicative, per-facility, and excludes DebiCheck —
   quoted as premium over those prices. They are flagged as approximate
   throughout and must stay that way until a bureau confirms in writing.

Two source-document conflicts, resolved here in favour of the newer document,
recorded so the older ones can be corrected:

- **`PARTNER_PORTAL_DESIGN.md` §4** says Starter is free and Growth is R250 per
  unit. The live site and the commission structure say flat band pricing at
  R925 / R2,660 / R6,014. This curriculum follows the live site.
- **`PARTNER_PORTAL_DESIGN.md` §13** locks the commission rate at a flat 10%
  lifetime. The commission structure supersedes it with 8 / 17 / 26 and earned
  lifetime. This curriculum follows the commission structure.

Review these before publishing, not after a partner quotes the wrong one.
