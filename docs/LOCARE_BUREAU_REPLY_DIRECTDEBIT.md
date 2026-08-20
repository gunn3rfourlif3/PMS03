# Reply to Direct Debit — 2026-08-19

Their answer to the structural question was yes: per-agency facility, Locare
manages the application, funds settle directly into the agency's trust account.
That validates LOCARE_DEBIT_ORDER_DESIGN.md §7.

Four things now decide whether this is workable. The retention structure is
first because it is the only one that can rule them out outright — everything
else is a number to negotiate.

Keep it short. They have been helpful and quick; this is a serious follow-up
from a serious buyer, not an interrogation.

---

**Subject:** RE: Sign-up process and EFT systems — four follow-ups before we proceed

Hi <name>,

Thank you — that is exactly what I needed, and the structure works for us. Each
agency holding its own facility with funds settling into its own trust account
is precisely the model we need, and I am happy to manage the applications on
their behalf.

Four things before we take it further.

**1. Retention and repayment.** The service guide gives an example of 90% of
collected funds released on day 7 and 10% on day 40, with a 10% security
retention.

This is the one that matters most to us. The money being collected is rent held
in trust — our agencies are estate agents governed by PPRA trust rules and must
account to property owners for rent collected, usually within the same month. A
structure that holds part of that back for 40 days would leave every owner
payout short, every month.

So: what retention and release terms would apply to a residential letting agency
collecting rent into a trust account, and is full release on collection possible
where a valid authenticated DebiCheck mandate exists? If retention is
unavoidable, what is the shortest release period you can offer, and what drives
it down — collection history, volume, an AVS check on every mandate?

**2. DebiCheck pricing.** The guide you sent covers EFT. We need DebiCheck, not
EFT — rent is a large recurring amount and the authenticated mandate is what
makes a collection defensible, so the fact that DebiCheck is "not disputable" is
worth paying for.

Please could you send the DebiCheck equivalents: per-collection fee, mandate
registration fee (real-time and delayed), amendment fee, unpaid fee, tracking
fee, and the monthly platform fee for the DebiCheck system.

**3. Trading history.** The sign-up requirements state a minimum of 12 months
trading history and three months of bank statements. A number of the agencies we
onboard are newly established. Is there any route for a newer agency — a
director guarantee, a lower limit, a probation period — or is 12 months a hard
requirement? This materially affects who we can sell to.

**4. Access and liability.** You mentioned the directors would authorise adding
us as a user with full access. Two questions on that:

- Is there a **restricted or submit-only** role, rather than full access? We
  only need to load mandates and submit collections; we would rather not hold
  the ability to change banking details or withdraw funds on an agency's
  facility.
- Where does **liability** sit for a collection submitted in error by us as the
  authorised user — with the agency, with Locare, or with Direct Debit? We would
  like this explicit in the agreement rather than assumed.

Two smaller ones while I have you:

5. Your DebiCheck system lists "File Upload, contract, and API capability."
   Could you send the **API documentation**, and confirm whether mandate
   registration, collection submission and result retrieval are all available
   over API? Is there a **sandbox** we can build against?
6. Can results be pushed to us via **webhook**, or do we poll?

For context on scale: we are a property-management platform, and each agency we
onboard would be a separate facility with you. If we are successful, that is a
steady stream of new merchants rather than one large account — so I would like
to understand whether there is a partner arrangement on the monthly platform fee
or the vetting fee where we introduce and manage the applications.

Happy to jump on a call.

Kind regards,

Arthur Jones
Locare
<email> · <phone> · locare.co.za

---

## What their documents already answered

Filed against `LOCARE_DEBIT_ORDER_DESIGN.md` so this does not get re-asked.

| Question | Answer | Affects |
|---|---|---|
| Per-agency facility, Locare submits, funds to agency trust account | **Yes** | §7 confirmed as designed |
| DebiCheck supported | Yes — separate system from EFT, "premium priced" | §3 decision 1 |
| DebiCheck disputability | **Not disputable** (EFT: disputable within 40 days) | §10 — this is the §2 argument in their words |
| Mandate authentication speed | Real-time (immediate) or delayed (up to 48h) | §4 `requested` state timing |
| Collecting outside mandate terms | *"Can only debit within the registered parameters of the mandate"* | §5 — the escalation trap, confirmed by the bureau |
| AVS | Built into DebiCheck; separate R5.40/txn for EFT | Onboarding |
| Submission cut-off | Two Day: 2 business days before 12:00. Same Day: before 12:00 that day | §5.5 — our T-3 check clears this with a day spare |
| Tracking | DebiCheck supports adding 10 tracking days to an unpaid | §11 open question 3 |
| API | DebiCheck system has "File Upload, contract, and API capability" | §5.2 / §8.2 — better than Stitch SFTP or Netcash SOAP, if it is a real API |

### EFT pricing received (for reference — we need DebiCheck)

Platform: **R419/month** Standard (manual file upload) or **R759/month**
Automated (contracts, API, Xero/Zapier). Once-off vetting **R349**.

Per debit, Two Day: R5.70 at 1–250/month, falling to R3.62 at 2000+.
Unpaid **R5.16**. Payout/transfer **R6.19**. Dispute **R21.81** under 40 days,
**R134.42** over. AVS R5.40. Telephone support R650/hour; email free.
All excluding VAT, billed in arrears.

**Note the shape of this:** platform fees are per facility, so they land on each
agency on top of their Locare subscription — roughly R533/month all-in for a
20-unit agency on Standard. That belongs in the pricing conversation and in the
partner intro pack, not discovered later.

### Still unanswered after these documents

- Retention and release terms for a trust-account collector (Q1)
- DebiCheck pricing (Q2)
- Any route for an agency under 12 months trading (Q3)
- Restricted-access role and liability allocation (Q4)
- API documentation, sandbox, webhooks (Q5–6)
- Settlement timing from collection to funds in the trust account
- Whether a partner rate exists on platform and vetting fees
