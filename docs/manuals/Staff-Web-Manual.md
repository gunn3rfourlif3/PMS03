# Demo Agency — Back-Office Manual (Staff)

A guide to the web console used by agency owners and property managers to run the
portfolio: properties, leases, billing, owners, maintenance, messaging and
branding. It also covers the **Owner Portal**, the read-mostly area your property
owners sign into.

> Screenshots use the seeded demo brand (green + gold). Your own logo and colours
> replace them once set in **Settings → Branding**.

**Contents**
Signing in · Dashboard · Properties & Units · Leases · Listings · Applications ·
Owners · Service Providers · Reports · Documents & e-sign · Inspections ·
API keys · Notifications · Messages · Settings (Branding) · Owner Portal

---

## Signing in

<img src="assets/staff-login.svg" alt="Login screen" width="840">

Authentication is **passwordless**. Enter your work email (e.g.
`owner@demo.test`) and press **Send code**. A six-digit one-time code is sent to
you (in development it prints to the API server console). Enter the code to sign
in. Staff land on the Dashboard; property owners are taken to the Owner Portal.

---

## Dashboard

<img src="assets/staff-dashboard.svg" alt="Dashboard" width="840">

Your portfolio at a glance: active leases, rent collected this period, total
outstanding, and occupancy. The **collection-rate** bar and **rent roll** show
how the month is tracking, and **Quick actions** shortcut the common jobs —
running billing, generating owner statements, and reviewing new applications.

---

## Properties & Units

<img src="assets/staff-properties.svg" alt="Properties" width="840">

Add a property with the form at the top (name, type, and an optional owner), then
expand any property to manage its **units** — label, status (vacant / occupied /
maintenance / reserved / offline), market rent and bed/bath counts. Deleting is
blocked while a property still has units, or a unit still has an active lease, so
you can't orphan records.

---

## Leases

<img src="assets/staff-leases.svg" alt="Leases" width="840">

Every active lease with its unit, tenant, term and rent. Select a lease to
**renew** it — enter an escalation percentage and a new term and the system
creates the renewal. Leases flagged *renewal due* are approaching their end date.

---

## Listings

<img src="assets/staff-listings.svg" alt="Listings" width="840">

Advertise a vacant unit: pick the unit, set the advertised rent and available-from
date, then **Create**. A draft listing is private until you **Publish** it. Only
vacant units appear in the picker.

---

## Applications

<img src="assets/staff-applications.svg" alt="Applications" width="840">

Prospective tenants appear here as they move through the funnel. **Screen** an
applicant (enter income and credit score in the pop-up) to get a recommendation,
then **Approve** — which opens a dialog for the lease start date and creates the
lease automatically — or **Reject**. All decisions run through confirmation
dialogs, so nothing happens by accident.

---

## Owners

<img src="assets/staff-owners.svg" alt="Owners" width="840">

The property owners you manage on behalf of. For each owner you can open their
**Statements** (monthly collected / fee / net) and pay out a finalised statement,
or edit their **Banking** details. Account numbers are **masked** in this list;
the full number is only fetched when you open the banking editor, and it's
**encrypted at rest**. A payout is refused until banking details are on file.

---

## Service Providers

<img src="assets/staff-providers.svg" alt="Service providers" width="840">

Your approved contractors — plumbers, electricians, landscapers, security, legal
and cleaning. Add them here with a category and contact. Active providers become
selectable when staff assign a maintenance ticket in the landlord app, with
category-matched providers offered first.

---

## Reports

<img src="assets/staff-reports.svg" alt="Reports" width="840">

The income statement for a period — rental income, expenses, management fees and
net payable to owners — with an **Export CSV** button for your accountant or
bookkeeping system.

---

## Documents & e-sign

<img src="assets/staff-documents.svg" alt="Documents" width="840">

Attach documents to a lease (lease agreements, receipts, notices). Upload a file
or register a placeholder, then **Download** or **Send to sign** — the latter
opens a dialog for the signer's email and returns a signing link. Documents are
versioned and their status (stored / awaiting signature / signed) is shown.

---

## Inspections

<img src="assets/staff-inspections.svg" alt="Inspections" width="840">

Move-in, routine and move-out condition reports. Record the condition of each
item, **sign off** the inspection, and apply any deductions to the tenant's
deposit.

---

## API keys

<img src="assets/staff-apikeys.svg" alt="API keys" width="840">

For integrations. Create a key with `read` and/or `write` scopes — the full key
is shown **once**, so copy it immediately. Keys can be revoked at any time
(revocation takes effect instantly), and the list shows each key's prefix,
scopes and status.

---

## Notifications

<img src="assets/staff-notifications.svg" alt="Notifications" width="840">

A delivery log of every message the system sent — rent invoices, payment
receipts, statements, renewal reminders and dunning notices — with the channel
(email / SMS / push) and status (queued / sent / delivered / failed).

---

## Messages

<img src="assets/staff-messages.svg" alt="Messages" width="840">

Two-way messaging with tenants. The inbox (left) lists conversations with unread
markers; open one to read the thread and **reply**. New tenant messages arrive
**live** — no refresh needed. Use **Close** to resolve a thread; a tenant reply
reopens it automatically.

---

## Settings — Branding

<img src="assets/staff-settings.svg" alt="Branding settings" width="840">

White-label the whole platform. Set your logo text, brand and accent colours, and
contact details; the **live preview** shows the result. These values drive the
web console, the tenant app and the landlord app, so a change here re-skins every
surface for your agency.

---

## Owner Portal

<img src="assets/owner-portal.svg" alt="Owner portal overview" width="840">

When a **property owner** signs in (role `owner`, e.g. `sipho@owner.demo.test`)
they land here instead of the back office, seeing only their own data. The
overview shows portfolio size, monthly rent, amounts paid to date and awaiting
payout, occupancy, and their latest statement. The portal's own menu —
**Overview, Statements, Properties, Banking** — lets owners review statements and
payouts, see their properties' occupancy, and keep their payout bank details up
to date. They never see other owners or the agency's back office.

---

*Demo Agency runs on PMS 0.3. For setup and running instructions see `RUN.md`; for
deployment see `DEPLOY.md`.*
