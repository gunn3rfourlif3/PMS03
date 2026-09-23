# Locare Service Directory — Design Doc

Status: draft for review · Owner: Vernon · Touches: `service-providers`,
`maintenance`, `partner-applications` (pattern only), platform admin

## 1. Summary

A **Locare-wide directory of vetted service providers** — attorneys, plumbers,
electricians, cleaners, security — that every agency on the platform can browse,
adopt into its own contractor list, and rate.

Four things it is not:

- It is not a marketplace. Locare does not quote, dispatch, invoice or take a
  cut of the job. The agency still phones the contractor and still pays them.
- It is not a replacement for an agency's own contractor list. Agencies keep
  their own people; the directory is a source of candidates, not a mandate.
- It is not a public review site. Ratings are collected from agencies and shown
  to agencies, in aggregate, and never published beyond the platform.
- It is not an advertising surface. A listing cannot be bought and placement
  cannot be bought — decided, and built in rather than merely intended (§6.5).

The commercial point: a new agency onboarding onto Locare arrives with no
contractor book for a suburb it has just taken stock in. "Here are four
electricians other agencies on this platform have actually used, and what they
thought" is a real reason to be on Locare rather than on a competitor.

## 2. Terminology — three different things share a name

This codebase already has two concepts that a reader will confuse with this one.
Naming has to be exact or the next person reads the wrong table.

| Concept | Table | Scope | What it is |
|---|---|---|---|
| **Agent** (existing) | `agents` | Vendor (RLS) | Rental referral agent inside one agency |
| **Partner** (existing) | `partners` | Platform | Reseller earning recurring % of a referred agency's subscription |
| **Service provider** (existing) | `service_providers` | Vendor (RLS) | *This agency's* approved contractor. Joined from `work_orders.contractor_id` |
| **Directory provider** (new) | `directory_providers` | Platform | A Locare-vetted business any agency can find and adopt |

"Directory" is the prefix throughout — `directory_providers`,
`directory_applications`, `directory_ratings`, `/directory/*`,
`/admin/directory/*`. A reader who sees `service_providers` in a query knows
immediately it is the agency's own row, not the shared entry.

## 3. What exists today

- `service_providers` — `TenantEntity`, RLS'd on `vendor_id`, columns
  `name, category, contactName, phone, email, notes, status`. Created in
  `1720000015000-ProvidersAndBanking`.
- `work_orders.contractor_id` → `service_providers.id`, nullable.
  `MaintenanceService.listWorkOrders()` does a raw `LEFT JOIN service_providers
  sp ON sp.id = w.contractor_id` for `contractorName` / `contractorCategory`.
- `web-admin/app/providers/page.tsx` — add / edit / activate-deactivate, filtered
  by category.
- `partner_applications` — a platform-scoped, two-stage, token-gated public
  vetting flow with document upload, a review queue at
  `/admin/partner-applications`, a reminder scheduler, and encrypted PII. This
  is the pattern the directory application copies. It is **not** a table to
  extend: partner KYC collects ID numbers and payout banking, and the directory
  needs neither (§10).

## 4. Shape — three tables and one column

### 4.1 `directory_providers` (platform, no RLS)

The curated entry. Readable by every authenticated agency user; writable only by
platform admin.

```
id                 uuid pk
trading_name       text not null
legal_name         text
categories         text[] not null        -- plumbing, electrical, legal, ...
regions            text[] not null        -- 'JHB North', 'Pretoria East', ...
contact_name       text
phone              text
email              text
website            text
about              text                   -- 2-3 lines, written by Locare, not marketing copy
registration_number text
vat_number         text
listing_status     text not null default 'draft'
                   -- draft | listed | vetting_expired | suspended | delisted
vetted_at          timestamptz
vetted_until       date                   -- driven by the shortest-dated document (§6.3)
vetted_by          text                   -- admin email
vetting_notes      text                   -- internal; never returned to agencies
application_id     uuid null references directory_applications(id)
created_at / updated_at
```

Indexes: GIN on `categories` and `regions` (the two filters the list page uses),
btree on `listing_status`.

No `vendor_id`, no RLS — this is deliberate and follows the documented exception
already established for `partners` / `vendor_subscriptions` in
`PARTNER_PORTAL_DESIGN.md` §3: the data is *intentionally* cross-tenant, and
access is enforced at the app layer. Agency-facing reads go through a service
that selects the public column set only, so `vetting_notes` cannot leak by
someone adding a `SELECT *`.

### 4.2 `directory_applications` (platform, no RLS)

Structurally the same two-stage flow as `partner_applications`, with a different
document set and materially less PII. Stage 1 is contact details and an emailed
link; stage 2 is detail plus documents, authorised by a hashed token, no login.

```
id, trading_name, legal_name, contact_name, contact_email (indexed),
contact_phone, categories text[], regions text[], registration_number,
vat_number, business_address, website,
documents jsonb   -- [{docType, url, key, name, uploadedAt}]
status text       -- started | draft | submitted | under_review
                  -- | info_requested | approved | rejected
reviewed_by, reviewed_at, decision_reason, risk_notes,
directory_provider_id uuid null,        -- set on approval
upload_token_hash, upload_token_expires, reminder_sent_at,
agreed_terms bool, consent_at timestamptz,
created_at / updated_at
```

Document types: `company_registration`, `vat_certificate`,
`public_liability_insurance`, `trade_registration` (PIRB / ECA(SA) / SAIA /
Law Society, per category), `reference`, `other`.

### 4.3 `directory_ratings` (vendor-scoped, **RLS**)

This is the one table that carries a `vendor_id`, and it gets a policy in the
same migration, per the standing rule in `CLAUDE.md`.

```
id                    uuid pk
vendor_id             uuid not null            -- the rating agency (RLS key)
directory_provider_id uuid not null references directory_providers(id)
work_order_id         uuid not null UNIQUE     -- one rating per job, forever
service_provider_id   uuid not null            -- the agency's adopted row
score                 int not null check (score between 1 and 5)
comment               text                     -- NEVER published (§5.3)
rated_by              uuid not null            -- users.id
created_at / updated_at
frozen_at             timestamptz              -- set 14 days after creation (§5.4)
```

RLS: the same policy form every tenant table uses, `USING` and `WITH CHECK` on
`"vendor_id" = NULLIF(current_setting('app.current_vendor_id', true), '')::uuid`
— the `NULLIF(..., true)` matters, because the bare `current_setting` raises
rather than returning null when the GUC is unset. So an agency reads and writes
only its own ratings. Nothing reads this table
across tenants except one `SECURITY DEFINER` function (§5.2), which returns
counts and averages and never a row.

### 4.4 `service_providers.directory_provider_id uuid null`

The adopt link. Nullable, because an agency's own plumber is not in the
directory and never will be. Indexed.

## 5. Ratings — integrity, and the anonymity problem

### 5.1 You cannot rate someone you did not hire

A rating requires a `work_order_id` whose work order:

- belongs to the rating agency (RLS gives this for free),
- is in status `completed` or `invoiced` — `work-order-transitions.ts` already
  defines those as terminal-ish states,
- has a `contractor_id` pointing at a `service_providers` row whose
  `directory_provider_id` is the provider being rated.

`work_order_id UNIQUE` means one rating per job, enforced by the database rather
than by a service that can be called twice. No job, no rating. This removes the
entire class of drive-by and competitor ratings without any moderation effort.

### 5.2 Aggregates cross the tenant boundary; rows never do

```sql
CREATE FUNCTION directory_provider_scores(p_ids uuid[])
RETURNS TABLE ("providerId" uuid, "raterCount" int, "jobCount" int,
               "rawAverage" numeric, "shrunkScore" numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ ... $$;
```

`SECURITY DEFINER` so it sees past RLS — the same mechanism already used for
public listings, branding and `platform_admin_is`. It returns `count(DISTINCT
vendor_id)` as `raterCount`, never a vendor id, never a comment, never a row.

`shrunkScore` is a Bayesian mean pulled toward the category average:

```
shrunk = (C * m + Σscores) / (C + n),  C = 3, m = category mean
```

Without it, one 5-star job puts a brand-new contractor above someone with
forty 4.6s, and the list is worthless in week one. With it, a provider has to
earn its way up. Raw average and job count are both shown as well, because a
number nobody can reconstruct is a number nobody trusts.

### 5.3 The anonymity problem, stated honestly

Locare has **one** agency live today. With one agency on the platform, an
"anonymous" rating is not anonymous: the provider knows exactly who it came
from. Even at ten agencies, a 1-star on a JHB North electrician narrows to two
or three candidates. Designing as though aggregation confers anonymity would be
a comfortable lie, and the first defamation letter would be the correction.

So:

1. **No score is shown until at least 3 distinct agencies have rated** a
   provider. Below that the entry reads "Vetted · not enough ratings yet" and
   lists the job count only. `raterCount` is `count(DISTINCT vendor_id)`, so one
   agency rating the same plumber twenty times never unlocks a score.
2. **Free-text comments are never shown to another agency, and never to the
   provider.** They exist for Locare's de-listing decisions and for the
   provider's right of reply (§6.4), both of which happen through a human.
3. **Providers never see their own rating rows** — only what an agency sees:
   count, average, distribution.
4. Agencies see their **own** past ratings in full, because those are their own
   records.

### 5.4 Editable briefly, then frozen

A rating can be edited by its author for 14 days, then `frozen_at` is set and it
is immutable. Deleting is not offered. Fourteen days covers "the geyser failed
again the next week"; permanent editability turns the score into a live
bargaining chip the provider can phone about.

## 6. Vetting

### 6.1 How a provider gets in

Public application at `/directory-apply` (mirrors `/partner-apply`), reviewed by
a platform admin at `/admin/directory-applications`. Two stages, token-gated,
throttled, exactly as `partner-applications.controller.ts` does it.

**Admin can also create an entry directly.** This is a deliberate second path,
not a shortcut: the directory is worthless empty, and the first dozen entries
will be contractors Vernon already knows and can vouch for. An admin-created
entry has `application_id IS NULL`, which is visible in the admin list, so
"vetted on paper" and "vetted on a handshake" are never confused six months
from now.

### 6.2 What "vetted" means, written down

It has to mean something specific or the word is a liability. v1:

- Company registration confirmed against CIPC number supplied.
- Valid **public liability insurance** certificate on file, in date.
- Trade-body registration where the category requires one (PIRB for plumbers,
  ECA(SA) for electricians, Legal Practice Council for attorneys).
- Two contactable references, at least one from a managing agent.
- No adverse findings on a basic search.

This list belongs on the public listing page verbatim, because the agency
relying on it deserves to know exactly how thin or how thick the check was.

### 6.3 Vetting expires

`vetted_until` is the **earliest** expiry among the documents on file —
insurance almost always. A scheduler (mirroring
`partner-applications.scheduler.ts`) emails the provider at 60 and 14 days, and
on expiry flips `listing_status` to `vetting_expired`.

An expired entry is **not** hidden. It shows as "Vetting lapsed — certificate
expired 12 March" and keeps its contact details, because an agency with a job
half-finished needs the phone number more than it needs our tidiness. It drops
out of default search results and cannot be newly adopted.

### 6.4 Suspension and right of reply

Before a provider is suspended or delisted on the strength of ratings, they are
told what the pattern is (not who said it) and given a written right of reply,
which is stored against the entry. A score alone never triggers suspension
automatically — a human decides, and the reason goes in `vetting_notes`.

### 6.5 A listing is not for sale

Decided: **a provider cannot pay to be listed, and cannot pay to rank higher.**
No listing fee, no featured slots, no sponsored row above the category, no
referral fee for sending an agency their way.

The only asset here is the word "vetted". An agency that suspects the top result
paid for the position has to check every entry itself — which is exactly the
work the directory exists to save it. One paid slot makes the other forty
worthless.

What that means in the code, so it cannot drift back in by accident:

- `directory_providers` carries no `featured`, `sponsored`, `rank_boost`,
  `placement` or `tier` column, and never should. Adding the column is the
  change to argue about, not the query that later reads it.
- Default order is `shrunkScore DESC, jobCount DESC` (§5.2), `trading_name` as
  the tiebreak. The sort has no term a human can set.
- The admin screens have no promote control. A platform admin can list, suspend
  and delist. There is no lever that moves an entry up.
- `/directory-apply` and the listing page both say so in plain words: listing is
  free, and placement cannot be bought.

The directory therefore costs money — the vetting hours in §6.2 — and earns
none directly. That is the trade: it pays back as a reason to onboard onto
Locare and a reason to stay, not as a line item. Worth stating, so that a year
from now the absence of revenue reads as a decision rather than as an oversight
someone should tidy up.

## 7. Adoption — directory entry to working contractor

`POST /directory/:id/adopt` inserts an ordinary `service_providers` row for the
calling agency, **copying** name, category, contact name, phone and email, and
setting `directory_provider_id`.

Copy rather than join, for a specific reason: `listWorkOrders()` and the
`/providers` page read `service_providers` directly, and a linked-but-empty row
would break both, as would moving contact details into a table those queries
have never heard of. Copying means every existing query keeps working unchanged
and an agency can keep its own notes, its own direct number for the foreman, and
deactivate the provider locally without touching anyone else's list.

The cost is drift. Handled by showing a quiet "directory has newer contact
details" prompt on the agency's provider row with a one-click refresh — never a
silent overwrite, because the agency's number may be better than ours.

Adopting twice is a no-op that returns the existing row.

## 8. API surface

**Public** (no auth, throttled, mirrors `partner-applications`):

```
POST   /directory-applications              stage 1 — contact, emails a link
GET    /directory-applications/:id?token=   resume
PATCH  /directory-applications/:id          save detail
POST   /directory-applications/:id/documents
POST   /directory-applications/:id/submit
POST   /directory-applications/:id/resend
```

**Agency** (`JwtAuthGuard` + `RolesGuard`, `vendor_owner` / `property_manager` —
the same pair `service-providers.controller.ts` already uses):

```
GET    /directory?category=&region=&q=      listed entries + scores
GET    /directory/:id                       detail + distribution + my ratings
POST   /directory/:id/adopt                 → service_providers row
POST   /work-orders/:id/rating              { score, comment? }
PATCH  /ratings/:id                         within 14 days, author only
GET    /directory/pending-ratings           completed jobs not yet rated
```

**Platform admin** (`@Roles('platform_admin')`):

```
GET    /admin/directory                     incl. draft / suspended
POST   /admin/directory                     direct create (§6.1)
PATCH  /admin/directory/:id
POST   /admin/directory/:id/list|suspend|delist
GET    /admin/directory/:id/ratings         scores + comments, for decisions
GET    /admin/directory-applications        review queue
POST   /admin/directory-applications/:id/review|approve|reject|request-info
```

Approval creates the `directory_providers` row in `draft`, so a second pair of
eyes lists it.

## 9. UI

- **`/providers`** gains two tabs: *My providers* (today's page, unchanged) and
  *Locare directory*. Directory cards show category, region, job count, score or
  "not enough ratings yet", vetting status, and an Adopt button.
- **Rating prompt** on completing a work order, and a dismissible count of
  unrated completed jobs on the maintenance page. One question, five stars, an
  optional comment marked *seen only by Locare*.
- **`/admin/directory`** and **`/admin/directory-applications`** — list, detail,
  decision, mirroring the partner-application screens.
- **`/directory-apply`** — public, mirrors `/partner-apply`.
- Marketing: a "Get listed" page linking to `/directory-apply`. Marketing is a
  static site behind `compose.prod.yml`, so it deploys separately from the API
  (`DEPLOY.md`).

## 10. Data protection and liability

**Collect less than partner KYC does.** No ID numbers, no date of birth, no
banking — Locare never pays these businesses, so there is no lawful basis to
hold their account details, and holding them is pure breach surface. Company
registration and VAT numbers are business identifiers, not personal
information. Contact name, phone and email are personal information of a
business contact, held on consent captured at application (`agreed_terms`,
`consent_at`) and published only inside the platform.

Consequence: `directory_applications` does **not** need the `encryptedJson`
transformer that `partner_applications` uses. If that ever changes — if we start
collecting director ID numbers — it needs the transformer and a migration, not a
plain column.

**Ratings are opinion about a business**, which is exactly the territory
defamation law cares about. Mitigations, all already in the design: ratings
require a real completed job; comments are never published; scores appear only
above three distinct raters; right of reply before delisting; and every rating
is attributable internally to a user and a work order, so a complaint can be
investigated rather than guessed at.

**Disclaimer.** `terms.html` needs a clause: Locare verifies the documents
listed in §6.2 at the date shown and nothing more; it does not warrant
workmanship, pricing or outcome; the contract is between the agency and the
provider. Without it, "Locare-vetted" is an implied warranty we did not intend
to give.

**Seed data.** Demo and video seeds use fictional providers only. Never seed a
real business with invented ratings — a screenshot of that in a demo is a
publication of a fabricated review about a real company.

## 11. Phasing

| Phase | Ships | Why here |
|---|---|---|
| 1 | `directory_providers`, adopt link + endpoint, admin CRUD, agency directory tab | A useful browsable list with zero rating machinery |
| 2 | `directory_applications`, public apply form, review queue, vetting expiry scheduler | Providers can come to us instead of being chased |
| 3 | `directory_ratings`, rating prompt, aggregate function, "my ratings" | Collect from day one of phase 3 |
| 4 | Publish scores once providers cross 3 distinct raters | Nothing to publish before then anyway |

Phase 3 collects silently for a while, which is the point: a score that appears
the day the feature ships is a score built on two jobs.

Migrations: `1720000054000-Directory` (providers, applications, the
`service_providers.directory_provider_id` column), `1720000055000-DirectoryRatings`
(ratings table, RLS policy, aggregate function). Numbering continues from
`1720000053000-AdminGrantConflicts`.

## 12. Open questions

1. **Do tenants and landlords ever rate?** Currently agency staff only. Tenants
   see the actual workmanship and would give the most authentic signal, at the
   cost of retaliatory ratings, a moderation queue, and a much harder anonymity
   story (one tenant, one job — the provider knows precisely who). Not phase 1.
2. **National or regional at launch?** One agency in JHB North means a national
   directory that is empty everywhere else. Suggest launching region-locked to
   where agencies actually are, and showing "no vetted providers in this area
   yet — know someone?" rather than an empty grid.
3. **Who does the vetting work?** §6.2 is perhaps 30–40 minutes per provider.
   At twenty providers that is a day; at two hundred it is a job. Worth knowing
   the ceiling before advertising the service.
4. **Attorneys are a different animal.** Legal Practice Council status, fidelity
   fund certificate, and the fact that an agency asking for an eviction attorney
   is in a dispute already. Possibly a separate category treatment rather than a
   row in the same grid.
5. **Does a delisted provider's history survive?** Proposed yes — ratings stay,
   the entry goes to `delisted` and stops appearing. Deleting the row would take
   the adopted `service_providers` links with it.
