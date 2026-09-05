# Locare — the audit-aftermath play

Written 2026-08-27. Owner: Arthur.

The first deliberate outbound sales motion. Aimed at a specific, dated moment
rather than at "letting agencies" in general.

---

## Why now, and why not this week

Trust audit reports go to the PPRA within **six months of financial year end**.
February is the most common year-end in South Africa, which puts the deadline at
**31 August**.

That is four days away. Nothing Locare does helps anyone meet it, so pitching
this week is noise arriving during someone's worst week of the year.

**The window is the two to three weeks after.** The audit is signed, the invoice
has landed, and the principal knows exactly what reconstruction cost. That is
the only moment in the year when "next year does not have to cost this" is a
statement about something they just lived through rather than a hypothetical.

There is a second, smaller cohort each quarter — June year-ends are due in
December, December year-ends in June — so this is repeatable, not a one-off.
Write it once, run it three times a year.

## Who this is aimed at

Narrower than the general ICP in the curriculum, deliberately.

**The target:** an agency of roughly 15–120 units, principal-owned, that
collects rent **manually today** — proof of payment, bank statement
reconciliation, a bookkeeper doing the rent run.

That last criterion is doing the most work. Locare's collection rail has never
processed a live payment (curriculum Module 1.6). For an agency already
reconciling manually, Locare is strictly better than their status quo on day
one, and the untested rail is upside they can adopt later rather than a
dependency they take on trust. **An agency that needs debit orders in month one
is a deal to delay, not to chase.**

**Disqualify quickly:** under 10 units, sales-only agencies, franchise branches
without signing authority, and anyone who needs a working collection rail
immediately.

## Where the names come from

- **The PPRA register of property practitioners** — the only complete list of
  this market that exists, and it is public. Filter by area.
- **Property24 and Private Property agency pages** — listing count is a rough
  proxy for portfolio size, so the unit band can be estimated before any
  contact.
- **Agencies with their own rentals site but no tenant portal** — visibly
  brand-conscious, visibly not solving the whole problem.
- **Bookkeepers who do trust reconciliations for several agencies.** One
  relationship, several introductions, and they are the people who felt August
  most acutely. Probably the highest-yield source on this list.

Start local. An SA agency buys from someone who can sit in their office.

## POPIA constrains how this is sent — read before writing a list

POPIA **section 69** prohibits direct marketing by unsolicited electronic
communication unless the recipient consented or is an existing customer. Two
features of it matter here and both are easy to get wrong:

- **A juristic person is a data subject under POPIA.** Unlike GDPR, "it's a
  company not a person" is not a defence.
- **The Information Regulator's December 2024 guidance note** draws the line at
  who the message targets. A **role-based address** — `info@`, `rentals@`,
  `admin@` — aimed at the business as a legal entity sits outside the strictest
  consent requirement. An email to a **named individual's** work address is
  targeting a natural person and needs consent.

**So: send to the agency's role mailbox, not to the principal by name.** At a
15–120 unit agency the `info@` inbox is usually read by the principal anyway, so
the cost is a slightly less personal opening and the benefit is not having to
rely on section 69(2)'s single-approach-for-consent route, which requires the
prescribed Form 4 and is impractical in an email.

Non-negotiable in every send, regardless:

- identify the sender clearly — real name, real company, `Locare (Pty) Ltd`
- a working opt-out in the message
- honour an objection immediately and permanently; keep a suppression list
- do not buy lists, and do not collect personal information you do not need
  (POPIA's minimisation principle applies to Locare too, and it would be a poor
  look for a company selling POPIA-aware software)

Not legal advice — worth ten minutes with the attorney already being briefed on
the trust-account question (`LOCARE_DEBIT_ORDER_DESIGN.md` §7.2), since they are
looking at Locare's compliance posture anyway.

## The email

Short, specific, no attachment, one link, one question. It leads with the
guide because the guide is genuinely useful whether or not they ever reply —
which is also what makes it a defensible thing to send.

> **Subject:** the part of the trust audit that costs the money
>
> Hello,
>
> If {agency} runs a February year-end, your trust audit report went in this
> week. I wrote something for the fortnight afterwards rather than the fortnight
> before — it is about why these audits get expensive, which is almost never the
> audit and almost always the reconstruction that had to happen first:
>
> {link}
>
> I build Locare, property-management software for South African rental
> agencies. The reason I care about this particular problem is that our ledger
> is double-entry and per-creditor, so the reconciliation an auditor asks for is
> an export rather than a rebuild.
>
> I am not going to pretend it is a mature product — one agency is live on it
> today and I am choosing the next few carefully. If the August you have just
> had was more expensive than you would like, I would rather show you how it
> works than send you a brochure.
>
> Worth twenty minutes?
>
> Arthur Jones
> Locare (Pty) Ltd · locare.co.za
>
> *Sent to {agency}'s published business address. Reply "no thanks" and I will
> not contact you again.*

**Why it is written this way.** The "one agency is live" line is not modesty, it
is qualification: it screens out anyone who needs a safe, established vendor,
and those people were never going to be founding customers. Saying it first also
means they cannot discover it later and wonder what else was omitted — which is
the failure mode curriculum Module 6.2 warns about.

### The single follow-up

One, about a week later, then stop. A third email converts nobody and costs
reputation in a market this small.

> **Subject:** re: the part of the trust audit that costs the money
>
> Hello again,
>
> Following up once and then I will leave you alone.
>
> The specific thing worth twenty minutes: a ledger per landlord and per tenant
> deposit, reconciling individually and in total, that you can export on the day
> your auditor asks. If you already have that, you genuinely do not need me and
> I would say so.
>
> Arthur
> Locare (Pty) Ltd · reply "no thanks" to be removed.

## What to do with a reply

**Interested** → demo, following the running order in curriculum Module 5.2.
Brand first, then the money path end to end. Do not talk price during the demo.

**"We're fine"** → believe them and ask one question: *what does your month-end
reconciliation actually look like?* Either the answer is comfortable and they
are not a prospect this year, or it is not and they have just told you the
problem themselves. Log it as Lost with the real reason either way.

**"Who else uses it?"** → the honest answer, per Module 6.2. One agency. Offer
the demo and direct access to the person who built it. Some will disqualify
themselves; that is the mechanism working.

## Tracking

Do not build a CRM. At this volume a spreadsheet with agency, contact, unit
estimate, date contacted, date followed up, outcome and reason is sufficient and
takes ten minutes to maintain.

The partner pipeline in the product is partner-scoped and is not the right tool
for Locare's own sales. If this motion ever justifies one, that is a signal to
revisit — not a reason to build now.

## Honest expectations

At 40 contacts, a 10–15% reply rate is a good outcome for cold outbound with a
genuinely useful piece attached — four to six conversations. Of those, one or
two demos and possibly one signing.

**One signing from this is a success**, because the constraint is not leads. It
is that onboarding an agency — DNS, migration, training, a watched first rent
run — is a real week of work for one person. Selling faster than you can onboard
in a word-of-mouth market is how you acquire a reputation you cannot outrun.

The purpose of this motion is not revenue. It is to get to **three to five
reference agencies**, because that is what makes the partner programme credible
— and the partner programme is the thing that actually scales. Which means the
VAT number is a sales blocker, not an admin task.

## Before sending

- [ ] Guide live at `/guides/trust-audit-cost-too-much` (rebuild `marketing`)
- [ ] First Dantalan subscription invoice cleared, so the reference customer is
      a paying one
- [ ] `LEADS_NOTIFY_EMAIL` set, so a reply through the site actually reaches you
- [ ] Sending mailbox is `arthur@locare.co.za` or similar — a real person, not
      `info@`
