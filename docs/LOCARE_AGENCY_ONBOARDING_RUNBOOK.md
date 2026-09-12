# Locare — agency onboarding runbook

Written 2026-09-05. Owner: Vernon. Status: **procedure is accurate; three steps
cannot yet be handed over** — see `LOCARE_AGENCY_ONBOARDING_REQUIREMENTS.md`.

The narrative version of this is curriculum Module 7, written for a partner
deciding whether to take the work on. This is the operational version: exact
steps, in order, with what to check before moving on. Module 7 explains *why*;
this explains *what to do*, and assumes the reader has never done it.

---

## Who does what

| Role | Who that is today | Needs |
|---|---|---|
| **Operator** | Vernon; later a Reseller or a hire | Back-office login, platform-admin rights, the intake form |
| **Platform admin** | Vernon only | SSH to the VPS. Steps 2.2, 2.3 and 4.2 require it |
| **Principal** | The agency's owner or decision-maker | Signs, chooses the domain, approves the data |
| **DNS controller** | Whoever holds the agency's registrar login | Often *not* the principal. Find them on day one |

**The single most common delay is DNS**, and it is almost always because the
person who can change records was identified in week two rather than day one.
Stage 0 exists mostly to prevent that.

---

## Timeline

| Stage | Elapsed | Operator effort |
|---|---|---|
| 0 · Intake | Day 0 | 45 min |
| 1 · Provision | Day 0 | 10 min |
| 2 · Domain & hosts | Day 0 request → 4–48 h propagation | 30 min + waiting |
| 3 · Brand | Day 1 | 30 min, principal-led |
| 4 · People | Day 1 | 30 min |
| 5 · Data | Days 1–4 | **The bulk of it — hours to days, by hand** |
| 6 · Money path | Day 2 onward | 45 min, plus bureau timelines outside our control |
| 7 · Dry run | Day 4 | 1 h |
| 8 · First rent run | First billing date | 1 h, watched |

Stage 5 dominates. Everything else is an afternoon.

The site now says **"live in a week"** (changed 2026-09-09 from "live in an
afternoon", which this runbook contradicted). A week is honest for an agency
with a portfolio to migrate, and it is the promise the timeline above supports.
An agency with nothing to migrate really can be live the same day — say that as
the exception rather than letting it set the expectation for everyone.

---

## Stage 0 — Intake, before anything technical

Confirm in writing. An email thread is sufficient; a form is better. Nothing in
Stage 1 or later starts until every row is answered.

| # | Item | Why it matters later |
|---|---|---|
| 0.1 | **Registered legal entity + registration number** | Goes on their invoices; it is the contracting party, not the trading name |
| 0.2 | **Signatory** — who can commit the agency | Avoids a demo-to-nowhere with someone who cannot buy |
| 0.3 | **VAT position** and VAT number if registered | They are invoiced ex-VAT plus 15% |
| 0.4 | **Unit count** (active leases, not properties) | Sets the tier. The 200th unit moves R6,014 → R12,600 and they must hear it from you now. Under 70 units they are on Custom at R85.91/unit, minimum 30 units — quotable, but never published |
| 0.5 | **Domain** for their branded site | Decides Stage 2 entirely |
| 0.6 | **Who controls that domain's DNS** — name, email, phone | The most common source of delay |
| 0.7 | **Collection intention** — debit order, EFT + proof of payment, or card | Debit orders need *their own* bureau facility, with its own vetting timeline run by the bureau, not by Locare |
| 0.8 | **Trust account details** and who reconciles it today | Determines what "correct" looks like at Stage 8 |
| 0.9 | **Go-live date** and the first billing date after it | The first rent run must be watched; diarise it now |
| 0.10 | **Data source** — spreadsheet, incumbent system export, paper files | Sizes Stage 5 honestly |
| 0.11 | **Named data contact** at the agency | Someone must answer "is this escalation date right?" within a day |

**Say out loud at intake, every time:** no live payment has ever been processed
through the collection rail, and WhatsApp messaging is off — everything falls
back to email. An agency that needs working debit orders in month one is a deal
to delay, not to chase (audit-season play; curriculum Modules 1.6 and 6.2).

**POPIA.** From Stage 5 you will be handling the agency's tenants' personal
information on their behalf. Confirm in writing that the agency instructs you to
process it, and do not copy their data anywhere outside Locare — no working
spreadsheets on a personal laptop that outlive the migration.

**Gate:** all eleven rows answered, in writing. Do not proceed on a verbal.

---

## Stage 1 — Provision the tenant

Creates the vendor, the owner user, the owner membership and a subscription row,
atomically.

### 1.1 Pick the route

- **Partner-referred** — the partner sends their referral link
  (`/signup?ref=<code>`) and the principal completes it. Creates the agency in
  `pending`; a platform admin approves it under **Admin → Signups**.
- **Partner-created** — the partner uses **Partner → Agencies → Add agency**.
  Creates it active immediately, attributed to that partner.
- **Direct (no partner)** — **there is no UI path.** Today this is a SQL call on
  the VPS by the platform admin. This is gap R-3 in the requirements doc.

Attribution is permanent: the first recorded referral wins, and a later partner
cannot take it over. Get it right at creation.

### 1.2 Set the price

`provision_agency()` always writes tier `starter`. Two things can be wrong after
it runs, and both are cheaper to fix now than after an invoice has gone out.

**If the intake unit count (0.4) puts them on Growth or Scale**, correct the tier
now — before the first invoice, not after.

**If they are under 70 units they are on the Custom tier**, priced per unit at
**R85.91** — Starter's fee divided by its entry point, so the two meet exactly at
70 units. The rate is computed automatically; you do not set it. It is not
published on the website, but you and your partners may quote it.

**A minimum of 30 billable units applies.** An agency with fewer pays as if it
had 30 (R2,577/month). Billing **refuses to invoice** such an agency until a
price is agreed in a `price_override` — it logs `NOT BILLING vendor …` at error
level and counts the run as `blocked`. So the failure mode is an agency that
bills nothing, not one that is overcharged; but it is still a customer you are
not invoicing, so agree the price at provisioning rather than when you notice the
missing revenue.

**A setup fee of R9,500 applies to every new agency**, once off, waived for the
first ten customers in exchange for a reference. It is not in the system: raise
it by hand and record it wherever you are tracking cash.

To agree a price below the minimum:

```sql
UPDATE vendor_subscriptions s
   SET price_override = <agreed monthly fee, ex-VAT>,
       price_override_reason = '<why — who agreed it, and when>',
       price_override_until = '<YYYY-MM-DD, the last day it applies>'
  FROM vendors v
 WHERE v.id = s.vendor_id AND v.slug = '<slug>';
```

Three notes on that statement:

- **`price_override_reason` is required** by a check constraint when an override
  is set. Write it for whoever reads it in a year, not for the constraint.
- **`price_override_until` is the last day the price applies**, not the first day
  it stops. An agency told "held until end March" is honoured on 31 March.
  Leaving it `NULL` makes the price open-ended — only do that deliberately.
- **The date is a commitment.** Put the review in a calendar three months before
  it, because the alternative is that the agency discovers the new price from an
  invoice. Nothing in the system will warn either of you.

**Say the billing basis out loud at intake.** Locare bills units under
management, vacancies included. At a flat band nobody notices; per unit, a
40-unit agency with 8 vacancies will notice. Agreeing it at 0.4 costs a sentence;
discovering it on an invoice costs a relationship.

Full reasoning, and every decision behind these numbers, is in
`LOCARE_PRICING_DECISIONS.md`.

### 1.3 Verify

```sql
SELECT v.id, v.name, v.slug, v.status, v.custom_domain,
       s.tier, s.status AS sub_status, s.referred_by_partner_id,
       s.unit_count, s.mrr, s.price_override, s.price_override_until
FROM vendors v JOIN vendor_subscriptions s ON s.vendor_id = v.id
WHERE v.name ILIKE '%<agency>%';

SELECT u.email, m.role FROM memberships m
JOIN users u ON u.id = m.user_id WHERE m.vendor_id = '<vendor-id>';
```

**Gate:** vendor `active`, one `vendor_owner` membership, tier matches intake,
and — for any agency under 30 units — `price_override` set with a reason and an
end date.

---

## Stage 2 — Domain and hosts

### 2.1 Give the DNS controller the records (their registrar)

Five hosts plus the apex, all pointing at the VPS:

```
A   @          169.58.46.223
A   www        169.58.46.223
A   app        169.58.46.223
A   api        169.58.46.223
A   tenant     169.58.46.223
A   landlord   169.58.46.223
A   rentals    169.58.46.223
```

TTL 300 while cutting over. Add `AAAA → 2a02:c207:2345:3343::1` for each if they
want IPv6.

**Do not touch their MX records.** If the agency currently receives mail on that
domain, an apex A record is fine, but a mistaken MX change takes their email
down and that is the worst possible first week.

Verify propagation before continuing:

```bash
nslookup app.<agencydomain>.co.za
```

### 2.2 Set the custom domain — *back office, no SSH*

This is the whole of bringing a domain live.

Open **Admin -> Onboarding -> <the agency>** and use the **Custom domain** panel
at the top of the page. Type the domain and press Save. Paste whatever the
agency sent you — `https://www.kimaz.co.za/`, `app.kimaz.co.za`, `KIMAZ.CO.ZA`
all normalise to the bare `kimaz.co.za`, which is what gets stored. The panel
then lists the six hostnames that will serve and the IP they must point at, so
it doubles as the checklist for 2.1.

It refuses, with a reason, a domain that is a public suffix (`co.za`), one that
belongs to Locare, and one already claimed by another agency — that last one
names the agency holding it.

To remove a domain, clear the field and save.

Nothing else is needed: no Caddyfile edit, no restart, no CORS change, no SSH.

If the back office is down, the equivalent is:

```sql
UPDATE vendors SET custom_domain = '<their-bare-domain>' WHERE slug = '<slug>';
```

Note that the cache holds a refusal for ten seconds, so a domain set by SQL
while someone was already browsing to it may need a moment. Saving through the
UI clears that cache immediately.

Caddy issues the certificate during the first HTTPS handshake, having asked the
API whether this domain belongs to an active agency. Certificates are refused
for a domain that is not on an active vendor, so the order matters — set the
domain BEFORE anyone browses to it, or the first attempt fails and Let's Encrypt
backs off.

CORS is answered from the same allowlist, so agency origins are permitted
automatically.

### 2.3 Confirm the domain is vouched for — *optional, one command*

If a certificate does not appear, this is the first thing to check. It answers
200 to issue and 404 to refuse, and nothing else:

```bash
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod exec api \
  node -e "fetch('http://localhost:3000/api/public/tls-check?domain=app.<their-domain>').then(r=>console.log(r.status))"
```

404 means the vendor is missing, suspended, or `custom_domain` is wrong. Note
there is no `curl` in the API image — use `node -e` as above.

Denials are cached for ten seconds and approvals for sixty, so wait a moment
after changing anything before re-testing.

### 2.4 Nothing to do here

Adding Caddy site blocks and CORS origins by hand used to be steps 2.2 and 2.3.
They were removed on 2026-09-12 when on-demand TLS was proven end to end
(`LOCARE_ONDEMAND_TLS_DESIGN.md` §7 step 4). The per-host blocks that already
exist for Dantalan are harmless and stay — an exact hostname always wins over
the catch-all.

### 2.5 Verify

```bash
curl -sI https://app.<domain>.co.za | head -3     # 200, valid TLS
curl -s  https://api.<domain>.co.za/api/health
curl -s  https://rentals.<domain>.co.za | head -20
```

**Gate:** all six hosts serve over HTTPS, the API answers, and the rentals page
shows the agency's name rather than the Locare default.

---

## Stage 3 — Brand

Principal-led, self-service, in **Settings → Branding**. Coach rather than do it
for them — it is the moment the product stops being yours and becomes theirs.

- Logo: **PNG or JPG over HTTPS**. SVG silently falls back to the wordmark in
  email, because Gmail and Outlook drop it.
- A square mark improves the browser-tab favicon per host.
- Brand colour re-tints the apps *and* outgoing email.

**Verify:** open `app.`, `rentals.`, `tenant.` and `landlord.` and confirm the
brand resolves on each. Then trigger one real email — an OTP login is enough —
and confirm the header carries their logo, not a broken image icon.

**Gate:** four surfaces branded, one email visually confirmed.

---

## Stage 4 — People

### 4.1 Staff and roles

Add each staff member with the narrowest role that lets them work. Tell them
before their first login:

- Login is **passwordless** — a one-time code by email. Nobody has a password,
  and staff will otherwise phone to ask for one.
- **Roles are baked into the token at sign-in.** A role change needs a full sign
  out and back in. This looks exactly like a bug if you are not expecting it.
- Codes expire in five minutes and are single-use.

Hand over the three existing manuals — staff web, tenant app, landlord app —
rather than re-explaining them.

### 4.2 Operator access — *platform admin, SSH*

Platform-admin rights come **only** from `PLATFORM_ADMIN_EMAILS` in
`deploy/.env.prod`, never from the database. Adding an operator therefore
requires an env edit and a container recreate (gap R-2).

Support access to an agency is by **impersonation** from Admin → Agencies, which
is audited: who, which agency, when, and the stated reason. Always give a real
reason — the audit trail is the agency's assurance, and it is the first thing
you will be asked for if a dispute ever arises.

**Gate:** every staff member has logged in once, successfully, before Stage 5
data lands.

---

## Stage 5 — Data migration

The longest stage and the one that produces silent errors. Everything here is
manual entry today; there is no import (gap R-5).

### 5.1 Order matters

Load in dependency order, verifying each level before the next:

1. **Owners** — including banking details (encrypted at rest automatically)
2. **Properties**
3. **Units** — including size, so listings render properly later
4. **Tenants**
5. **Leases** — real start dates, rent, deposit, escalation percentage and
   escalation month
6. **Opening balances** — see 5.3

### 5.2 The fields that cause month-four problems

Check these against source documents, not against what someone remembers:

- **Escalation date and percentage.** A wrong escalation is invisible until it
  fires. Finding it in month one is a conversation; in month four it is a
  credibility problem and a set of correcting ledger entries.
- **Lease start date**, which drives pro-rata on the first invoice.
- **Deposit held** — how much, and whether interest is owed to the tenant under
  the Rental Housing Act.
- **Owner banking**, which is the money leaving the trust account.

### 5.3 Opening balances

A lease imported without its history produces a ledger that starts from nowhere:
arrears vanish and the first owner statement is wrong.

The ledger is immutable by design. A wrong opening posting is corrected by a
**reversing entry, never an edit** — so the balances go in once, checked, with
the principal's sign-off in writing on the arrears list before you post.

### 5.4 Verify

```sql
-- Counts against the intake numbers
SELECT (SELECT count(*) FROM properties WHERE vendor_id=$1) AS properties,
       (SELECT count(*) FROM units      WHERE vendor_id=$1) AS units,
       (SELECT count(*) FROM leases     WHERE vendor_id=$1 AND status='active') AS active_leases,
       (SELECT count(*) FROM owners     WHERE vendor_id=$1) AS owners;

-- The invariant: every posting balances
SELECT sum(debit) - sum(credit) AS must_be_zero FROM ledger_entries WHERE vendor_id=$1;
```

**Gate:** counts match intake 0.4 exactly, the ledger nets to zero, and the
principal has signed off the arrears list.

---

## Stage 6 — Money path

### 6.1 Collection method

- **EFT + proof of payment** — works today, nothing external needed. This is the
  right default, and for an agency that reconciles manually it is already better
  than their status quo.
- **Card / instant EFT** — needs their own merchant credentials.
- **Debit order** — needs *their own* bureau facility. Application and vetting
  run on the bureau's timeline, not ours. Never quote a date for it.

### 6.2 Be accurate about what is proven

No live payment has been processed end to end. Set expectations at intake, not
when the first tenant tries to pay.

### 6.3 Verify

Raise one invoice, pay it by the agency's chosen method, and confirm it
reconciles: invoice flips to paid, the ledger shows the matching postings, and
the tenant sees it in their app.

**Gate:** one payment reconciled end to end, in their tenant, on their domain.

---

## Stage 7 — Dry run, before the first live rent run

With staff present, on their domain, using their data:

1. Generate invoices for a single property. Check amounts and pro-rata.
2. Record a payment. Check allocation and the ledger.
3. Produce **one owner statement end to end** and read every line with the
   principal.
4. Log a maintenance ticket from the tenant app and assign it.
5. Send one lease for e-signature and sign it.

Anything wrong here is cheap. The same thing wrong in Stage 8 is not.

**Gate:** the principal agrees the owner statement is correct.

---

## Stage 8 — The first rent run

**Watch it. Do not assume it.** Be available on the billing date.

- Invoices generated for **every** active lease — count them against 5.4
- Amounts match the leases, including any escalation that fell due
- The ledger balances
- Dunning did not fire on someone who is not actually in arrears
- One owner statement, checked line by line, before any payout

Then, deliberately: confirm the agency's **first subscription invoice** to
Locare is issued and paid. An onboarded agency that never gets billed is not a
customer, and this has been the single most-deferred step in the business.

**Gate:** first rent run correct, first subscription invoice cleared.

---

## Stage 9 — Handover

- The three manuals, sent again, to the people who will actually use them
- Named escalation path: what the operator handles, what goes to Locare
- Diarise a check-in **after the second rent run** — the first is watched, the
  second is where habits show
- Record the outcome, including anything that took longer than this runbook
  says. Update the runbook rather than remembering the exception

**For Resellers:** first-line support is governed by a Reseller Support
Addendum which is **not yet written**. Until it exists, do not state response
times, and never promise a fix or a date on Locare's behalf.

---

## Abort and rollback

| Stage | If it goes wrong |
|---|---|
| 0–1 | Set the vendor `status='suspended'`. Nothing is public yet |
| 2 | Remove the Caddy blocks and restart Caddy; ask the agency to drop the A records. Their old site returns as soon as DNS propagates |
| 3–4 | Reversible in the UI |
| 5 | Data can be corrected, but ledger postings are corrected by **reversal, never deletion**. Stop and reverse rather than improvising |
| 6–8 | Escalate to Locare. Anything touching money movement is out of an operator's scope |

**Never** delete a vendor to "start clean" once Stage 5 has posted to the
ledger. Suspend it, and get a decision from Locare.

---

## Definition of done

- [ ] Six hosts live over HTTPS, brand resolving on all four app surfaces
- [ ] Staff trained, each logged in at least once
- [ ] Data counts match intake; ledger nets to zero; arrears signed off
- [ ] One payment reconciled end to end
- [ ] One owner statement agreed correct by the principal
- [ ] First rent run watched and correct
- [ ] Price agreed in writing, and an override recorded if they are under 30 units
- [ ] Setup fee raised, or explicitly waived and recorded as waived
- [ ] First Locare subscription invoice issued and paid — for the agreed amount
- [ ] Second-rent-run check-in diarised
