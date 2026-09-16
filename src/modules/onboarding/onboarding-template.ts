/**
 * The onboarding checklist, as data.
 *
 * Mirrors LOCARE_AGENCY_ONBOARDING_RUNBOOK.md stage for stage. The runbook stays
 * the prose source of truth for HOW each step is done; this is the machine's
 * copy of WHAT the steps are, so an onboarding can be tracked, handed over and
 * audited.
 *
 * VERSIONED ON PURPOSE. Editing the runbook must not rewrite the history of an
 * onboarding already in flight, so items are stamped with the version they were
 * seeded from and a change here applies to agencies seeded afterwards. Bump
 * TEMPLATE_VERSION whenever items are added, removed or reweighted.
 *
 * `weightHours` are estimated operator hours and total 22 — the realistic figure
 * for a 40-unit migrating agency worked out in LOCARE_PRICING_DECISIONS.md. They
 * are what the progress bar measures, because nine stages are not nine equal
 * steps: stage 5 alone is a third of the work, and a bar that counts items
 * reaches 55% in an afternoon and then sits still for three days.
 */

export const TEMPLATE_VERSION = 'runbook-2026-09';

export type WaitingOn = 'locare' | 'agency' | 'third_party';

export interface TemplateItem {
  /** Stable key. Never renumber one in place — that breaks in-flight agencies. */
  key: string;
  stage: number;
  title: string;
  detail?: string;
  weightHours: number;
  /** Has an automated check (R-9). Phase 1 ships the flag, not the checks. */
  verifiable: boolean;
  /**
   * How a person proves this item is actually done, today, by hand.
   *
   * Deliberately NOT copied into an agency's rows at seed time: these are
   * instructions, they get better, and an in-flight agency should get the
   * improved wording rather than whatever was true the day they were seeded.
   * `detail()` joins them on by item key at read time.
   *
   * Every one of these should end in something observed — a page that renders,
   * a number that matches, a command that answers — never "confirm that it
   * works", which is what the operator was already trying to do.
   */
  howToCheck?: string;
  waitingOn: WaitingOn;
}

export interface TemplateStage {
  stage: number;
  name: string;
  /** One line telling the operator what this stage is FOR, not how to do it. */
  purpose: string;
}

export const STAGES: TemplateStage[] = [
  { stage: 0, name: 'Intake', purpose: 'Get every answer in writing before anything technical starts.' },
  { stage: 1, name: 'Provision the tenant', purpose: 'Create the agency, its owner, and its price.' },
  { stage: 2, name: 'Domain and hosts', purpose: 'Bring their six hosts live over HTTPS.' },
  { stage: 3, name: 'Brand', purpose: 'Make every surface look like them, not like us.' },
  { stage: 4, name: 'People', purpose: 'Give their staff access, and make sure they can use it.' },
  { stage: 5, name: 'Data migration', purpose: 'Move the portfolio across so the numbers are right on day one.' },
  { stage: 6, name: 'Money path', purpose: 'Decide and configure how rent actually gets collected.' },
  { stage: 7, name: 'Dry run', purpose: 'Prove the rent run works before it runs for real.' },
  { stage: 8, name: 'First rent run', purpose: 'Watch the first live run end to end.' },
  { stage: 9, name: 'Handover', purpose: 'Leave them able to run it without you.' },
];

export const TEMPLATE: TemplateItem[] = [
  // ── 0 · Intake — all attestation. The first stage of an onboarding is a
  // conversation, and no query can tell you it happened.
  //
  // These wait on LOCARE, not on the agency, even though the agency supplies the
  // answers. A brand-new onboarding is waiting on someone here to go and ask;
  // until that happens the ball is ours. Defaulting them to `agency` made every
  // fresh onboarding read as though the agency were being slow about a question
  // nobody had put to them. The operator flips an item to `agency` once it has
  // actually been asked — which is real information, and the point of the field.
  { key: '0.1-entity', stage: 0, title: 'Legal entity and registration number confirmed', detail: 'The contracting party, not the trading name. It goes on their invoices.', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },
  { key: '0.2-signatory', stage: 0, title: 'Signatory identified', detail: 'Someone who can actually commit the agency.', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.3-vat', stage: 0, title: 'VAT position and number captured', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.4-units', stage: 0, title: 'Unit count confirmed (active leases)', detail: 'Sets the tier and the price. Under 70 units is Custom; under 30 needs an agreed override.', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },
  { key: '0.5-domain', stage: 0, title: 'Domain for their branded site agreed', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.6-dns-contact', stage: 0, title: 'DNS controller named, with email and phone', detail: 'The most common source of delay in the whole process.', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.7-collection', stage: 0, title: 'Collection method decided', detail: 'Debit order needs their own bureau facility, with the bureau’s own timeline.', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.8-trust', stage: 0, title: 'Trust account details and who reconciles it today', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.9-golive', stage: 0, title: 'Go-live date and first billing date diarised', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.10-data-source', stage: 0, title: 'Data source established', detail: 'Spreadsheet, incumbent export, or paper. Sizes stage 5 honestly.', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },
  { key: '0.11-data-contact', stage: 0, title: 'Named data contact at the agency', detail: 'Someone who answers "is this escalation date right?" within a day.', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.12-popia', stage: 0, title: 'POPIA processing instruction confirmed in writing', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },

  // ── 1 · Provision
  { key: '1.1-provision', stage: 1, title: 'Agency, owner user and membership created', weightHours: 0.2, verifiable: true, howToCheck:
    'Admin -> Agencies: the agency is listed and active. Open its back office — you should land in their dashboard, branded as them. If it was a direct sale, also confirm no partner is recorded: a direct agency showing an attribution pays commission for as long as it lives.', waitingOn: 'locare' },
  { key: '1.2-price', stage: 1, title: 'Tier correct and price agreed', detail: 'Under 30 units, billing will not invoice at all until a price_override exists.', weightHours: 0.2, verifiable: true, howToCheck:
    'Open the agency’s Billing page. The tier must match the unit count from intake 0.4 — under 70 units is Custom, under 30 needs a price override with a reason AND an end date. An override with no end date is how a floor stops being a floor.', waitingOn: 'locare' },
  { key: '1.3-setup-fee', stage: 1, title: 'Setup fee raised, or recorded as waived', weightHours: 0.1, verifiable: false, waitingOn: 'locare' },

  // ── 2 · Domain and hosts
  { key: '2.1-dns-records', stage: 2, title: 'DNS records sent to their controller', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '2.2-dns-live', stage: 2, title: 'Records live and resolving', detail: 'Out of our hands. Days, not hours, is normal.', weightHours: 0.1, verifiable: true, howToCheck:
    'Check all seven records, not just app. In a terminal: nslookup app.<domain>, then www, api, tenant, landlord, rentals, and the bare domain. Every one must answer 169.58.46.223. An empty answer is a record nobody created; a different address is usually the registrar’s parking page still holding the apex.', waitingOn: 'third_party' },
  { key: '2.3-hosts-tls', stage: 2, title: 'Six hosts serving over HTTPS with valid certificates', weightHours: 0.4, verifiable: true, howToCheck:
    'Open https://app.<domain> in a private window: a padlock and no warning. Repeat for the other five hosts. A certificate issues on the first visit, so the first load can take a few seconds. If one refuses, ask the API whether it vouches for the domain — runbook 2.3 has the one-line tls-check probe — a 404 there means the domain is wrong, or the vendor is not active.', waitingOn: 'locare' },
  { key: '2.4-cors', stage: 2, title: 'App origins allowed by the API', weightHours: 0.2, verifiable: true, howToCheck:
    'Sign in at https://app.<domain> and load a page with data on it. If the origin were not allowed the sign-in would fail with a network error rather than a message — open the browser console and confirm there are no CORS errors. This is answered from the same custom domain as 2.5, so it is almost always fixed by fixing that.', waitingOn: 'locare' },
  { key: '2.5-custom-domain', stage: 2, title: 'Tenant pointed at the custom domain', weightHours: 0.1, verifiable: true, howToCheck:
    'Admin -> Onboarding -> this agency: the Custom domain panel shows their BARE domain (agency.co.za, not app.agency.co.za). Then open https://app.<domain>/login — it must show the agency’s name and colours, not Locare’s. Locare branding there means the host did not resolve to this vendor.', waitingOn: 'locare' },

  // ── 3 · Brand
  { key: '3.1-assets', stage: 3, title: 'Logo and colours received', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },
  { key: '3.2-applied', stage: 3, title: 'Branding applied and resolving on all four surfaces', weightHours: 1.0, verifiable: true, howToCheck:
    'Open all four surfaces and look at them: app (the login card), tenant, landlord, and the public rentals page. Each should carry the agency’s logo and colours. Check the rentals footer specifically — it must show THIS agency’s mark and contact details, never another agency’s. That leaked once and only surfaced when a second agency went live.', waitingOn: 'locare' },
  { key: '3.3-approved', stage: 3, title: 'Principal has seen it and approved', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },

  // ── 4 · People
  { key: '4.1-staff', stage: 4, title: 'Staff accounts created with the right roles', weightHours: 0.5, verifiable: true, howToCheck:
    'In the agency’s back office, open Settings -> Users. Every person from intake is listed with the role they were meant to get. A property manager with vendor_owner rights can change the agency’s banking details, so check the roles, not just the names.', waitingOn: 'locare' },
  { key: '4.2-logins', stage: 4, title: 'Every staff member has logged in at least once', weightHours: 0.5, verifiable: true, howToCheck:
    'Impersonating them is NOT proof — it proves your access, not theirs. Have each person sign in themselves once, on their own device, while you are on the call. A one-time code that never arrives is the failure you are looking for, and it is usually a typo in their email address.', waitingOn: 'agency' },
  { key: '4.3-training', stage: 4, title: 'Staff trained', detail: 'Never one session. Budget for a second.', weightHours: 1.5, verifiable: false, waitingOn: 'locare' },

  // ── 5 · Data migration — the stage that is a third of the job.
  { key: '5.1-properties', stage: 5, title: 'Properties and units loaded', weightHours: 2.5, verifiable: true, howToCheck:
    'Compare counts to intake 0.4: Admin -> Imports shows rows imported per file, and the agency’s Properties page shows the totals. They must match the number the agency gave you, not roughly match. Then open three units at random and check the rent against the source sheet.', waitingOn: 'locare' },
  { key: '5.2-tenants-leases', stage: 5, title: 'Tenants and leases loaded', weightHours: 2.0, verifiable: true, howToCheck:
    'Every active lease has a tenant attached and a rent amount. Spot-check three against the source for rent, start date and escalation — an escalation date that is a month out surfaces in month four as a credibility problem, and the fix by then is a reversing entry.', waitingOn: 'locare' },
  { key: '5.3-fields', stage: 5, title: 'Escalation dates, deposits and deposit location captured', detail: 'The fields that cause month-four problems.', weightHours: 1.0, verifiable: false, waitingOn: 'locare' },
  { key: '5.4-opening-balances', stage: 5, title: 'Opening balances and arrears loaded and signed off', weightHours: 1.0, verifiable: false, waitingOn: 'agency' },
  { key: '5.5-reconciles', stage: 5, title: 'Counts match intake and the ledger nets to zero', weightHours: 0.5, verifiable: true, howToCheck:
    'Two numbers. The unit count on the dashboard equals intake 0.4. The arrears total equals the signed opening-balance schedule — same rand figure, to the cent. If they differ, a row was blocked and skipped, and the import screen names which one.', waitingOn: 'locare' },

  // ── 6 · Money path
  { key: '6.1-method', stage: 6, title: 'Collection method configured', weightHours: 1.0, verifiable: true, howToCheck:
    'Whatever was chosen in intake 0.7, prove it moves money in test mode: for a card or EFT link, complete one payment end to end; for debit order, the bureau must have confirmed the service agreement in writing. A provider configured but never exercised is not done.', waitingOn: 'locare' },
  { key: '6.2-expectations', stage: 6, title: 'Told plainly what is and is not proven', detail: 'No live payment has ever been processed through the collection rail. Say so.', weightHours: 0.5, verifiable: false, waitingOn: 'locare' },
  { key: '6.3-references', stage: 6, title: 'Payment references and mandates in place', weightHours: 0.5, verifiable: true, howToCheck:
    'Every active lease resolves to a payment reference a tenant can actually quote. For debit order, each mandate is authenticated and active — an unauthenticated mandate collects nothing, silently, on the day it matters.', waitingOn: 'locare' },

  // ── 7 · Dry run
  { key: '7.1-test-invoice', stage: 7, title: 'Test invoice posts and balances', weightHours: 0.7, verifiable: true, howToCheck:
    'Run billing for a test period and open the result: the invoice posts, and the ledger for that transaction balances — debits equal credits. Then reverse it. If the reversal does not net the ledger back to zero, stop and do not go live.', waitingOn: 'locare' },
  { key: '7.2-statement', stage: 7, title: 'Owner statement produced and checked', weightHours: 0.5, verifiable: false, waitingOn: 'locare' },
  { key: '7.3-reversed', stage: 7, title: 'Dry-run data reversed out', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },

  // ── 8 · First rent run
  { key: '8.1-run', stage: 8, title: 'First live rent run completed', weightHours: 1.0, verifiable: true, howToCheck:
    'After the live run, the invoice count equals the number of active leases. Any lease that did not produce an invoice is a tenant nobody billed this month, and they will not tell you.', waitingOn: 'locare' },
  { key: '8.2-payment', stage: 8, title: 'One payment reconciled end to end', weightHours: 0.5, verifiable: true, howToCheck:
    'Take one real payment and follow it all the way: the payment is allocated to its invoice, the invoice shows paid, the trust ledger moved, and it appears on the owner’s statement. One payment proven end to end is worth more than every other check on this list.', waitingOn: 'locare' },
  { key: '8.3-statement-agreed', stage: 8, title: 'One owner statement agreed correct by the principal', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },

  // ── 9 · Handover
  { key: '9.1-docs', stage: 9, title: 'Support route and escalation path given to them', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },
  { key: '9.2-checkin', stage: 9, title: 'Second-rent-run check-in diarised', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '9.3-signoff', stage: 9, title: 'Principal signs off that onboarding is complete', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },
];

/** Total estimated hours for a full onboarding. */
export const TEMPLATE_TOTAL_HOURS = TEMPLATE.reduce((sum, i) => sum + i.weightHours, 0);

export const stageName = (stage: number): string =>
  STAGES.find((s) => s.stage === stage)?.name ?? `Stage ${stage}`;
