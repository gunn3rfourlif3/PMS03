# Locare — Debit Orders (DebiCheck) as the Rent Collection Rail

Status: **Draft for discussion — not approved for build.** Owner: Arthur.
Last updated: 2026-08-15.

Move rent collection from manual EFT + proof-of-payment onto an authenticated
debit order (DebiCheck), with PayShap Request as the arrears rail and
proof-of-payment retained permanently as the fallback.

---

## 1. Problem & goal

Rent is collected today by the tenant making a manual EFT and uploading a proof
of payment, which a staff member reviews and accepts. It works, and it will
always need to exist, but it puts a human in the path of every rand and makes
collection rate a function of how diligently tenants remember.

The obvious alternative — a card gateway — is not viable on the numbers:

| Rail | Fee | On R12 000 rent |
|---|---|---|
| Card | 3.2% + R2 | ~R386 |
| Instant EFT / Capitec Pay | 2.0% | ~R240 |
| **DebiCheck (flat)** | **per-collection, single-digit rands** | **~R5–R10** |

A typical agency earns 8–10% commission — R960–R1 200 on that unit. A 2% gateway
fee consumes **20–25% of the agency's entire revenue** on the tenancy. Nobody
will absorb that, and passing it to tenants makes Locare the reason rent went up.

A flat per-collection fee on R12 000 is roughly **0.08%**. That is the whole
argument for this rail, and it is the reason SA rentals already run on debit
orders.

**Goal:** rent collects itself on the due date, arrives in the agency's trust
account, and posts to the ledger only when it has actually settled.

---

## 2. Rails considered

| Rail | Mechanism | Verdict |
|---|---|---|
| **DebiCheck** | Authenticated debit order on the EFT rail. Tenant pre-approves a mandate **at their own bank**. Pull-based. | **Primary.** The bank-held mandate is what makes a rent collection defensible when it's later disputed. |
| Legacy EFT debit order | Unauthenticated pull. | **No.** Cheaper, but easily disputed and reversed. For rent — large amounts, adversarial by the time it's contested — that trade is wrong. |
| **PayShap Request** | Payer approves a request in their banking app; clears in real time. Limit raised R3 000 → **R50 000 in Oct 2024**, so rent now fits. | **Companion.** Push-based, so not a mandate substitute. Ideal for arrears, part-payments and mid-month catch-ups — where we currently have nothing. |
| Variable Recurring Payments | Capitec + Stitch, launched late 2025, against 25m+ Capitec customers. | **Watch.** Capitec is over-represented among SA tenants. Ask about it at quote stage. |
| Manual EFT + proof of payment | What exists today. | **Keep permanently.** A meaningful share of tenants will always pay by hand. |

---

## 3. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Primary rent rail | **DebiCheck**, per-tenancy mandate. |
| 2 | Arrears rail | **PayShap Request**, sent from the arrears queue. |
| 3 | Fallback | **Proof of payment stays**, unchanged and permanent. |
| 4 | Provider | **Stitch** — already integrated (`#24`), and covers DebiCheck, PayShap Request, Pay by bank and VRP behind one API. Netcash as competing quote. |
| 5 | Settlement destination | Agency **trust account**. |
| 5a | Merchant of record | **Each agency is its own merchant.** Locare never holds tenant money. See §7. |
| 6 | Ledger posting | **On settlement confirmation only.** Never on submission. |
| 7 | Failed collection | A **new posting**, never an edit. Consistent with the immutable ledger. |
| 8 | Mandate ceiling | Amend-and-re-authenticate **before** an escalation breaches it. See §5. |

---

## 4. Mandate lifecycle

A mandate is a first-class entity, not a flag on a lease. It has its own state
machine, its own audit trail, and it outlives individual collections.

```
                 tenant signs lease
                        │
                        ▼
                   [ drafted ]
                        │  submit to provider
                        ▼
                  [ requested ] ──── tenant declines / times out ──▶ [ rejected ]
                        │  tenant authenticates at their bank
                        ▼
                    [ active ] ◀──────────────┐
                    │      │                  │ re-authenticated
      escalation    │      │ tenant/agency    │
      exceeds max   │      │ cancels          │
                    ▼      ▼                  │
              [ amending ] [ cancelled ]      │
                    └───────────────────────-─┘
```

- `drafted` — created with the lease, nothing sent yet.
- `requested` — sent to the provider; awaiting the tenant's approval at their
  bank. Has an expiry; chase before it lapses.
- `active` — collections may be submitted against it.
- `amending` — an amendment is out for re-authentication. **Collections continue
  against the old mandate at the old ceiling** until the new one is active.
- `cancelled` / `rejected` — terminal. A new mandate is required.

Fields worth calling out: `maxCollectionAmount`, `collectionDay`,
`firstCollectionDate`, `providerMandateRef`, `authenticatedAt`, `expiresAt`.

`providerMandateRef` and any tenant banking details are PII — store via the
`encryptedJson` transformer (`src/common/security/pii-crypto.ts`), same as owner
banking and partner KYC.

Mandates are tenant-scoped data → RLS policy in the same migration as the table.
Non-negotiable, per CLAUDE.md.

---

## 5. The escalation trap

**This is the part most rental systems get wrong, and the reason this document
exists before any code.**

A DebiCheck mandate carries a **maximum collection amount**. Locare does annual
rent escalations (`#78`). When an escalation pushes rent above the mandate
ceiling, the collection is **rejected by the bank** — not partially collected,
not silently reduced. Rejected.

If nobody notices, the failure mode is: escalation applies, next collection
fails, tenant appears to be in arrears through no fault of their own, dunning
fires at them, and the agency's collection rate drops for a reason no one can
see.

Mitigations, all required:

1. **Set the ceiling above the rent at mandate creation** — rent plus a
   configured headroom (`DEBICHECK_MANDATE_HEADROOM_PCT`, suggest 15%), so
   routine escalations fit without an amendment.
2. **Check before escalating.** The escalation job must compare the new rent
   against the mandate ceiling and, where it breaches, open an amendment and
   notify the tenant **before** the new amount is due.
3. **Never let an escalation land silently on a breaching mandate.** If the
   amendment isn't authenticated in time, hold the escalation, keep collecting
   the old amount, and raise it in the back office. Under-collecting for one
   month is recoverable; a failed collection and a false arrears record is not.
4. **Surface it.** Mandate state belongs on the lease view and in the arrears
   queue, not buried in settings.

---

## 6. Collection lifecycle and the ledger

Unlike a card authorisation, a debit order resolves over **days**, and can fail
after apparently succeeding.

```
[ scheduled ] ──▶ [ submitted ] ──▶ [ settled ]  ──▶ (may still be) [ disputed ]
                        │
                        └──────────▶ [ unpaid ]  (insufficient funds, closed account)
```

**The ledger rule: nothing posts until settlement is confirmed.**

- `scheduled` / `submitted` — no ledger movement. The invoice remains
  outstanding. Rent that has been *asked for* is not rent *received*.
- `settled` — post exactly as `recordManual()` does today: allocate against the
  invoice, debit `TRUST_BANK` (1200), credit `ACCOUNTS_RECEIVABLE` (1000).
  Reuse the existing path rather than adding a parallel one.
- `unpaid` — no reversal needed, because nothing was posted. Mark the collection
  unpaid, leave the invoice outstanding, let existing dunning (`#26`) do its job.
- `disputed` **after** settlement — this is the one that requires a reversal.
  A **new** posting, equal and opposite. Never edit or delete the original.
  The ledger is immutable; corrections are new postings.

Getting this wrong in the other direction — posting on submission and reversing
on failure — would mean the trust account shows money that isn't there. For a
PPRA-regulated trust account that is not a bug, it's a finding.

Retry/tracking behaviour (resubmitting when a salary lands) is provider-specific
— ask at quote stage, and model retries as new collections against the same
mandate rather than mutating one.

---

## 7. Merchant of record — **decided: each agency is its own merchant**

Rent lands in the **agency's** trust account, collected under the **agency's own**
DebiCheck user code. Locare stores per-vendor credentials and submits on their
behalf. **Tenant money never touches a Locare account.**

The alternative — Locare collecting centrally and distributing — was rejected.
It would mean holding client money, which pulls Locare into PPRA trust
obligations it has no licence for and makes it look like a payment intermediary.
Faster onboarding is not worth becoming a regulated entity by accident.

This is the right call, and it also matches how the ledger already thinks: the
trust account (`TRUST_BANK`, 1200) is the agency's, and owner payouts and
commission already flow out of it. Nothing in the accounting model changes.

### 7.1 What this decision costs

Being honest about the trade, because it lands almost entirely on onboarding:

**Each agency must register its own DebiCheck user code** with a sponsoring bank
or bureau — a FICA'd application, not an API call, and realistically weeks not
days. That is now part of agency onboarding, and it is a sales objection: an
agency cannot collect rent through Locare on day one.

**So the rail must degrade gracefully.** An agency is fully usable before its
merchant registration completes — invoicing, proof-of-payment, statements and
reporting all work. Debit orders switch on when the user code is live. Model
this explicitly on the vendor:

```
not_registered → applied → active → suspended
```

Only `active` may submit collections. Everything else falls back to
proof-of-payment, and the back office says why. This state is also the honest
answer to "when can we start collecting?" during a sales conversation.

**Credentials are per-vendor and sensitive.** Store them in a
`vendor_payment_credentials` table via the `encryptedJson` transformer, with an
RLS policy in the same migration — same treatment as owner banking and partner
KYC. The gateway registry (`#102`) already resolves providers per vendor, so
this extends an existing seam rather than cutting a new one.

**Support burden shifts.** A failed collection is between the agency and its
bureau; Locare can surface status and reasons but cannot resolve a mandate
dispute on the agency's behalf. Set that expectation in onboarding, or the
support queue will fill with things Locare has no authority to fix.

**Locare's own revenue is unaffected**, because it was never on this rail:
subscription fees are billed separately from agencies (`#181`) via PayFast or
iKhokha. The two money flows stay cleanly apart, which is exactly what we want.

### 7.2 Still needs confirming

The structure is decided; two things still need a professional eye:

- An attorney or the PPRA confirming that Locare **submitting collections as a
  technical agent**, on credentials the agency owns, does not itself constitute
  handling client money. The design intends it doesn't; that intent should be
  checked, not assumed.
- The bureau's contracting model — whether Locare signs as a technology partner
  alongside each agency, and what that agreement says about liability for a
  collection submitted in error.

This also interacts with the outstanding POPIA item: Locare still has no
registered entity name on its legal pages, and it will need one to sign
anything with a bureau.

---

## 8. Provider evaluation

Ask each provider for **four** numbers, not one — the headline per-collection
fee hides the rest:

1. per-collection fee
2. mandate authentication fee (initial, and per amendment)
3. unpaid / reject fee
4. dispute fee, and any monthly platform minimum

Also ask: sandbox availability, retry/tracking support, settlement timing into a
third-party trust account, whether they sponsor the user code, and VRP
availability.

| Provider | Notes |
|---|---|
| **Stitch** | Already integrated. DebiCheck + PayShap Request + Pay by bank + VRP behind one API. Extending an existing provider rather than adding a fourth. |
| Netcash | Established bureau. DebiCheck via batch file + `NIWS_NIF` web service — more integration work than a REST API. |
| Direct Debit / others | Worth a third quote for price discovery. |

---

## 9. Build outline (not estimated)

1. Migration: `debit_order_mandates`, `debit_order_collections` and
   `vendor_payment_credentials`, all with RLS policies in the same file. PII and
   credentials via `encryptedJson`. Add the merchant-registration state
   (`not_registered → applied → active → suspended`) to the vendor.
2. `DebitOrderProvider` interface alongside the existing payment providers —
   `requestMandate`, `amendMandate`, `cancelMandate`, `submitCollection`,
   plus inbound status webhooks. Stitch implementation behind a `LIVE` flag, as
   the other gateways are.
3. Mandate state machine + amendment flow; wire the escalation job to §5.
4. Collection scheduler (BullMQ, alongside recurring billing) — submit on the
   mandate's collection day, respecting the provider's lead time.
5. Webhook handler → settlement confirmation → existing `recordManual()` path.
   Signature verification **enforced** from day one; do not repeat the iKhokha
   monitor-mode drift.
6. Back office: merchant-registration status and credential capture in
   settings; mandate status on the lease; a collections run view; failures
   surfaced in the arrears queue. Collections must be impossible to submit
   unless the vendor is `active`.
7. Tenant app: mandate authentication prompt, and mandate status on the Pay
   screen so a tenant can see rent will be collected automatically.
8. PayShap Request from the arrears queue.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Escalation breaches mandate ceiling | §5 — headroom, pre-checks, hold rather than fail. |
| Money posted before it settles | §6 — post on confirmation only. |
| Locare inadvertently holds client money | §7 — decided: per-agency merchant, Locare submits as technical agent only. Confirm with an attorney (§7.2). |
| Agency can't collect on day one | §7.1 — registration state machine; proof-of-payment covers the gap and the back office says why. |
| Collection submitted against the wrong vendor's credentials | Credentials resolved through the existing per-vendor gateway registry, inside the RLS transaction. Never a global default. |
| Tenant never authenticates the mandate | Mandate expiry chase; proof-of-payment fallback always available. |
| Provider lock-in | Keep it behind the provider interface, as with payment/notification/kyc. |
| Disputes | DebiCheck's authenticated mandate is the defence; retain mandate evidence. |

---

## 11. Open questions

1. ~~Trust account structure~~ — **decided (§7): each agency is its own
   merchant.** Residual legal confirmation in §7.2.
2. Per-collection pricing from all three providers — none publish it. Ask
   whether pricing is per-merchant or whether Locare can negotiate a partner
   rate card its agencies inherit; that materially changes the sales pitch.
3. Retry/tracking behaviour and whether it's worth the extra fee.
4. Does the first collection need to differ (pro-rata first month)?
5. Deposit collection — same rail, or keep manual? Deposits post to
   `DEPOSIT_TRUST` (2200) and carry interest obligations under the Rental
   Housing Act, so they may warrant separate treatment.

---

## Sources

- [Stitch — a guide to South African payment rails](https://stitch.money/blog/a-guide-to-south-african-payment-rails)
- [Stitch — DebiCheck](https://stitch.money/payment-methods/debicheck)
- [Netcash — DebiCheck](https://netcash.co.za/services/debicheck/)
- [Hyphen — three years of PayShap](https://www.hyphen.co.za/news/payshap/)

Fees and rail details were gathered in August 2026 from provider and industry
sources; none of the bureaux publish DebiCheck pricing, so every number in §1
beyond the card rates is an order-of-magnitude estimate pending quotes.
