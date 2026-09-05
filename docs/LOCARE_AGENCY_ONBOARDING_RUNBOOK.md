# Locare — agency onboarding runbook

Written 2026-09-05. Owner: Arthur. Status: **procedure is accurate; three steps
cannot yet be handed over** — see `LOCARE_AGENCY_ONBOARDING_REQUIREMENTS.md`.

The narrative version of this is curriculum Module 7, written for a partner
deciding whether to take the work on. This is the operational version: exact
steps, in order, with what to check before moving on. Module 7 explains *why*;
this explains *what to do*, and assumes the reader has never done it.

---

## Who does what

| Role | Who that is today | Needs |
|---|---|---|
| **Operator** | Arthur; later a Reseller or a hire | Back-office login, platform-admin rights, the intake form |
| **Platform admin** | Arthur only | SSH to the VPS. Steps 2.2, 2.3 and 4.2 require it |
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

Stage 5 dominates. Everything else is an afternoon. Any promise of "live in an
afternoon" refers to a **new** agency with no history to migrate — say so
plainly rather than letting the marketing line set the expectation.

---

## Stage 0 — Intake, before anything technical

Confirm in writing. An email thread is sufficient; a form is better. Nothing in
Stage 1 or later starts until every row is answered.

| # | Item | Why it matters later |
|---|---|---|
| 0.1 | **Registered legal entity + registration number** | Goes on their invoices; it is the contracting party, not the trading name |
| 0.2 | **Signatory** — who can commit the agency | Avoids a demo-to-nowhere with someone who cannot buy |
| 0.3 | **VAT position** and VAT number if registered | They are invoiced ex-VAT plus 15% |
| 0.4 | **Unit count** (active leases, not properties) | Sets the tier. A 13th unit moves R925 → R2,660 and they must hear it from you now |
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

### 1.2 Correct the tier

`provision_agency()` always writes tier `starter`. If the intake unit count
(0.4) puts them on Growth or Scale, correct it now — before the first invoice,
not after.

### 1.3 Verify

```sql
SELECT v.id, v.name, v.slug, v.status, v.custom_domain,
       s.tier, s.status AS sub_status, s.referred_by_partner_id
FROM vendors v JOIN vendor_subscriptions s ON s.vendor_id = v.id
WHERE v.name ILIKE '%<agency>%';

SELECT u.email, m.role FROM memberships m
JOIN users u ON u.id = m.user_id WHERE m.vendor_id = '<vendor-id>';
```

**Gate:** vendor `active`, one `vendor_owner` membership, tier matches intake.

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

### 2.2 Add the Caddy site blocks — *platform admin, SSH*

Follow the `dantalan.co.za` blocks in `deploy/Caddyfile` exactly; there is one
per host. Caddy issues TLS itself over HTTP-01 once DNS resolves, so do this
**after** 2.1 has propagated or the certificate request fails and backs off.

Config is mounted, so no rebuild — but `caddy reload` silently no-ops on this
box. Restart the container:

```bash
docker restart $(docker ps -qf name=caddy)
```

### 2.3 Add the origins to CORS — *platform admin, SSH*

Every agency front-end origin must be in `CORS_ORIGINS` in `deploy/.env.prod`,
or the browser blocks every API call and the app looks broken while the logs
look clean.

```bash
docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod up -d --force-recreate api
```

`--force-recreate` is not optional: env is fixed at container creation and a
plain restart will not pick it up.

### 2.4 Point the tenant at the domain

Set `vendors.custom_domain` to the agency's bare domain so public branding and
the rentals site resolve by host. There is no UI for this — SQL today (gap R-4).

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
- [ ] First Locare subscription invoice issued and paid
- [ ] Second-rent-run check-in diarised
