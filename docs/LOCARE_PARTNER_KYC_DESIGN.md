# Locare — Partner Vetting (KYC/KYB) & Approval

**Status:** Design / proposed
**Decisions:** both individual (KYC) and business (KYB) partners; **manual review**,
built **provider-ready** (automated KYC/KYB can be plugged in later).
**Context:** SA financial partners → FICA/POPIA-aware. Partners earn commission and
receive payouts, so identity + banking must be vetted before they get portal access.

---

## 1. Goal

Replace the fully-manual "admin creates a partner + grants login" flow with a
vetted pipeline: a prospective partner **applies** and submits identity/business
details + supporting documents; a platform admin **reviews** and **approves or
rejects**; approval automatically provisions the partner and their login. Nothing
is provisioned until vetting passes.

Lifecycle:

```
applicant submits  →  submitted  →  under_review  →  approved  → (partner + login created)
                                              └────→  rejected  → (reason emailed)
                                              └────→  info_requested → (applicant updates → resubmit)
```

## 2. Data model (platform-scoped, no RLS)

**`partner_applications`**

| column | notes |
|---|---|
| id (uuid) | pk |
| type | `'individual' \| 'business'` |
| contact_name / contact_email / contact_phone | applicant contact; email is the future login |
| **KYC (individual)** | full_name, id_type (`sa_id`/`passport`), id_number *(enc)*, date_of_birth, residential_address |
| **KYB (business)** | company_name, registration_number (CIPC), vat_number, business_address, directors *(jsonb: [{name, idNumber(enc)}])* |
| banking *(enc jsonb)* | bank_name, account_holder, account_number, branch_code, account_type — for commission payouts |
| documents (jsonb) | `[{ docType, url, name, uploadedAt }]` (see §4) |
| consent | agreed_terms bool, consent_at |
| status | `draft \| submitted \| under_review \| info_requested \| approved \| rejected` |
| review | reviewed_by (admin user id), reviewed_at, decision_reason, risk_notes |
| risk (jsonb) | provider pre-check results (empty until a provider is wired) |
| partner_id | set on approval (link to the created partner) |
| created_at / updated_at | |

PII (id_number, director id numbers, banking) is encrypted at rest via the existing
`encryptedJson` transformer (AES-256-GCM, `PII_ENCRYPTION_KEY`). Documents are
stored privately via `MediaService`.

## 3. Backend

**Public (unauthenticated, throttled):**
- `POST /partner-applications` — create a draft from submitted fields. Returns
  `{ id, uploadToken }`. The `uploadToken` is a short-lived, single-use-scoped
  secret (Redis, like the e-sign ref) that authorises document uploads for this
  application without a login.
- `POST /partner-applications/:id/documents` — multipart upload (requires the
  `uploadToken`); appends to `documents`. Types: `id_document`, `proof_of_address`,
  `company_registration`, `director_id`, `bank_confirmation`, `vat_certificate`,
  `other`. Size-capped, pdf/image only.
- `POST /partner-applications/:id/submit` — (requires `uploadToken`) validates
  required fields/docs per type, flips `draft → submitted`, and notifies
  `partners@locare.co.za`.

**Platform-admin (`@Roles('platform_admin')`):**
- `GET /admin/partner-applications?status=` — queue.
- `GET /admin/partner-applications/:id` — full detail; banking **masked**
  (`maskBanking`), documents with signed view URLs.
- `POST /admin/partner-applications/:id/review` — moves `submitted → under_review`
  (claims it, records reviewer).
- `POST /admin/partner-applications/:id/approve` — **idempotent**; creates the
  `partners` row (status `active`, ref code, commission rate from the request or
  default), inserts `partner_members` for `contact_email` (get-or-create user →
  grant login), sets application `approved` + `partner_id` + reviewer, emails the
  applicant a welcome. This is the single "provision" path.
- `POST /admin/partner-applications/:id/reject` — status `rejected` + reason;
  emails the applicant a (kind) decline.
- `POST /admin/partner-applications/:id/request-info` — status `info_requested` +
  note; re-opens uploads (fresh `uploadToken` emailed) so the applicant can fix and
  resubmit.

**Provider-ready:** a `KycProvider` interface (`verifyIndividual`,
`verifyBusiness` → `{ passed, score, findings }`) with a **manual/no-op default**.
On submit we *may* call it and stash results in `risk` for the admin to see. Wiring
a real provider (Smile ID, Ozow verify, CIPC lookup, sanctions/PEP) later needs no
schema change.

## 4. Web

**Public application** — a multi-step page at `app.locare.co.za/partner-apply`
(public route; the marketing "Register as a partner" button links here):
1. Choose type (individual / business) + contact details.
2. KYC or KYB fields (conditional on type).
3. Banking details (for payouts) + consent checkbox.
4. Upload documents (required set depends on type — see below).
5. Review & submit → confirmation screen.

**Admin review** — `Admin → Partners → Applications` (new tab / page):
- Queue of `submitted` / `under_review` applications with type + submitted date.
- Detail drawer: all fields, masked banking, document viewer, provider risk (if
  any), and **Approve / Reject / Request info** with a reason box.
- On approve, the new partner appears in the existing Partners list, active.

**Required documents (manual review):**
- *Individual:* ID/passport, proof of address, bank confirmation letter.
- *Business:* company registration (CIPC), each director's ID, proof of business
  address, bank confirmation letter; VAT certificate if VAT-registered.

## 5. Compliance (FICA / POPIA)

- **Lawful basis + consent:** explicit consent checkbox; store `consent_at`.
- **Data minimisation & retention:** collect only what vetting needs; note a
  retention period for rejected applications (e.g. purge documents after N days).
- **Encryption at rest:** ID numbers + banking encrypted; documents in private
  storage; banking always **masked** in admin views.
- **Auditability:** every decision records reviewer + timestamp + reason.
- **Access:** applications visible only to platform admins.

## 6. Phasing / tasks

1. **Migration + entities** — `partner_applications` (+ enc PII), statuses, indexes.
2. **Backend public** — submit + upload-token + document upload + validation +
   notify partners@.
3. **Backend admin** — queue, detail (masked), review/approve/reject/request-info;
   approve provisions partner + login (reuse existing partner creation).
4. **`KycProvider` interface** — manual default, `risk` plumbing (provider-ready).
5. **Web public** — multi-step application form + uploads.
6. **Web admin** — applications queue + review UI.
7. **Notifications** — submit→partners@, approve/reject/request-info→applicant.
8. **Tests + verify** — status-machine + approve-provisioning unit tests, typecheck.

## 7. Open questions

- **Commission rate at approval:** admin sets it during approval (default 10%) — or
  is it negotiated off-platform and just recorded? (Assumed: admin sets on approve.)
- **Where the form lives:** `app.locare.co.za/partner-apply` (recommended, has API +
  uploads) vs a static marketing page. Marketing button links to the app route.
- **Document retention window** for rejected applicants (POPIA) — needs a policy
  number (default proposal: purge documents 90 days after rejection).
