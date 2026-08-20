# Bureau enquiry — DebiCheck for Locare

Send to Netcash, and to any alternative under evaluation (RealPay, BankTech,
Direct Debit). Question 1 is the qualifier: if the answer is no, the rest does
not matter, so it is deliberately first and deliberately blunt.

Substitute the entity name and contact details once the registration is issued
(outstanding POPIA item — see CLAUDE.md).

---

**Subject:** DebiCheck for a multi-agency rental platform — integration and pricing enquiry

Hi <name>,

I run Locare, a white-label property-management platform for South African
rental agencies. Each agency runs its whole rental operation — leasing, rent
collection, maintenance, owner payouts — under its own brand and domain.

We are moving rent collection onto DebiCheck and are evaluating bureaux. One
structural question decides whether we can work together, so I have put it
first.

**1. Can we submit collections on behalf of many client agencies, each under
its own DebiCheck user code, with funds settling directly into each agency's
own trust account?**

Locare would act as the technical submitter only. We never hold tenant money —
each agency is the merchant of record and the beneficiary. If your model
requires us to be the collecting entity with funds passing through an account we
control, that does not work for us: our agencies hold client money under PPRA
trust rules and we are not a licensed intermediary.

If the answer is yes, the rest of these matter.

### Integration

2. Is there an **API** for collections, or are collections submitted as batch
   files? If files, over what transport — SFTP, HTTPS, a web service?
3. How do results come back, and how quickly? Specifically: how do we learn that
   (a) a submitted batch was accepted, and (b) each individual collection
   succeeded or failed? Are those separate events?
4. Are **webhooks** available for mandate status changes and collection results,
   or is polling required?
5. Is mandate creation and amendment available over API, and is authentication
   real-time or batch?
6. Is there a **sandbox** we can integrate and test against before contracting?
7. What are the file format specifications and API documentation — can you send
   them now, before we commit?

### Commercial

Please quote all of these, not just the per-collection rate:

8. Per-collection fee
9. Mandate authentication fee — initial, and per amendment
10. Unpaid / rejected collection fee
11. Dispute fee
12. Any monthly platform minimum, setup fee, or per-agency account fee
13. Is pricing per merchant, or can Locare negotiate a **partner rate card that
    our agencies inherit**? This materially changes what we can offer them.

### Operational

14. **Settlement timing** — how long from successful collection to funds
    reflecting in the agency's trust account?
15. Do you **sponsor the user code**, or does each agency need its own
    sponsoring bank relationship? What is the realistic **turnaround** to get a
    new agency live?
16. What does an agency need to provide at registration (FICA, bank
    confirmation, etc.)?
17. **Retry / tracking** — do you offer automatic retry on an unpaid, or
    account tracking? What does it cost, and does it improve collection rates
    enough to be worth it?
18. What **collection days** are supported, and do you handle adjustment when a
    collection day falls on a weekend or public holiday?
19. How are **mandate amendments** handled when rent escalates above the
    authorised maximum — what is the process and how long does re-authentication
    take?
20. Is **PayShap Request** available for arrears collection, and **Capitec Pay
    Recurring / VRP**?

### Contractual and risk

21. What is the **contracting model** where a technology provider submits on
    behalf of client merchants? Do we sign as a technology partner alongside
    each agency, or does each agency contract with you directly?
22. Where does **liability** sit for a collection submitted in error — the
    agency, Locare, or the bureau?
23. From 13 April 2026 debit orders, DebiCheck and registered mandates are
    disputable for 60 days rather than 12 months. Has that changed your dispute
    handling or fees?
24. What evidence do you retain for a disputed collection, and what do you need
    from us to defend one?

Happy to jump on a call if that is easier than working through this in writing.
If there is a technical contact who should see questions 2–7 directly, please
point me at them.

Kind regards,

Arthur Jones
Locare
<email> · <phone> · locare.co.za

---

## Why each question is here

Cross-references to `LOCARE_DEBIT_ORDER_DESIGN.md`, so answers can be filed
against the decisions they affect.

| Q | Decides |
|---|---|
| 1 | §7 — the per-agency merchant model. A "no" invalidates §7 and forces a rethink before any further build. |
| 2–3 | §5.2 — Stitch is SFTP batch files, Netcash is a SOAP `BatchFileUpload`. Anyone offering a real API for collections beats both on integration cost. |
| 4 | §6 — the ledger posts on settlement confirmation only, so how results arrive drives the reconciliation design. |
| 5 | §4 — mandate lifecycle. Batch-only authentication slows tenant onboarding materially. |
| 6–7 | Whether we can build and verify before signing anything. |
| 8–12 | §8 — the four numbers. The headline per-collection fee hides the rest, and rejects are the ones that bite at scale. |
| 13 | §8 — a partner rate card our agencies inherit is a sales argument; per-merchant pricing is not. |
| 14 | §6 — settlement timing sets how stale the ledger is against the bank. |
| 15–16 | §7.1 — "an agency cannot collect on day one" is the cost of the per-agency decision. The turnaround number is what we tell prospects. |
| 17 | §11 open question 3. |
| 18 | §11.7 — collection day and `dayAdjustmentAllowed`. |
| 19 | §5 — the escalation trap. Re-authentication turnaround decides how far ahead the amendment must be opened. |
| 20 | §2 — PayShap Request is the arrears rail; VRP is the one to watch. |
| 21–22 | §7.2 — the contracting and liability questions an attorney flagged as unresolved. |
| 23 | §8.3 — shortens the dispute tail; worth confirming it is reflected in their fees. |
| 24 | §10 — the authenticated mandate is the defence; we already capture `mandateReferenceNumber` off the consent webhook. |
