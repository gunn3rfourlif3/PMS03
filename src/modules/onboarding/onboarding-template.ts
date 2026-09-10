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
  { key: '0.1-entity', stage: 0, title: 'Legal entity and registration number confirmed', detail: 'The contracting party, not the trading name. It goes on their invoices.', weightHours: 0.3, verifiable: false, waitingOn: 'agency' },
  { key: '0.2-signatory', stage: 0, title: 'Signatory identified', detail: 'Someone who can actually commit the agency.', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.3-vat', stage: 0, title: 'VAT position and number captured', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.4-units', stage: 0, title: 'Unit count confirmed (active leases)', detail: 'Sets the tier and the price. Under 70 units is Custom; under 30 needs an agreed override.', weightHours: 0.3, verifiable: false, waitingOn: 'agency' },
  { key: '0.5-domain', stage: 0, title: 'Domain for their branded site agreed', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.6-dns-contact', stage: 0, title: 'DNS controller named, with email and phone', detail: 'The most common source of delay in the whole process.', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.7-collection', stage: 0, title: 'Collection method decided', detail: 'Debit order needs their own bureau facility, with the bureau’s own timeline.', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.8-trust', stage: 0, title: 'Trust account details and who reconciles it today', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.9-golive', stage: 0, title: 'Go-live date and first billing date diarised', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '0.10-data-source', stage: 0, title: 'Data source established', detail: 'Spreadsheet, incumbent export, or paper. Sizes stage 5 honestly.', weightHours: 0.3, verifiable: false, waitingOn: 'agency' },
  { key: '0.11-data-contact', stage: 0, title: 'Named data contact at the agency', detail: 'Someone who answers "is this escalation date right?" within a day.', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },
  { key: '0.12-popia', stage: 0, title: 'POPIA processing instruction confirmed in writing', weightHours: 0.2, verifiable: false, waitingOn: 'agency' },

  // ── 1 · Provision
  { key: '1.1-provision', stage: 1, title: 'Agency, owner user and membership created', weightHours: 0.2, verifiable: true, waitingOn: 'locare' },
  { key: '1.2-price', stage: 1, title: 'Tier correct and price agreed', detail: 'Under 30 units, billing will not invoice at all until a price_override exists.', weightHours: 0.2, verifiable: true, waitingOn: 'locare' },
  { key: '1.3-setup-fee', stage: 1, title: 'Setup fee raised, or recorded as waived', weightHours: 0.1, verifiable: false, waitingOn: 'locare' },

  // ── 2 · Domain and hosts
  { key: '2.1-dns-records', stage: 2, title: 'DNS records sent to their controller', weightHours: 0.2, verifiable: false, waitingOn: 'locare' },
  { key: '2.2-dns-live', stage: 2, title: 'Records live and resolving', detail: 'Out of our hands. Days, not hours, is normal.', weightHours: 0.1, verifiable: true, waitingOn: 'third_party' },
  { key: '2.3-hosts-tls', stage: 2, title: 'Six hosts serving over HTTPS with valid certificates', weightHours: 0.4, verifiable: true, waitingOn: 'locare' },
  { key: '2.4-cors', stage: 2, title: 'App origins allowed by the API', weightHours: 0.2, verifiable: true, waitingOn: 'locare' },
  { key: '2.5-custom-domain', stage: 2, title: 'Tenant pointed at the custom domain', weightHours: 0.1, verifiable: true, waitingOn: 'locare' },

  // ── 3 · Brand
  { key: '3.1-assets', stage: 3, title: 'Logo and colours received', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },
  { key: '3.2-applied', stage: 3, title: 'Branding applied and resolving on all four surfaces', weightHours: 1.0, verifiable: true, waitingOn: 'locare' },
  { key: '3.3-approved', stage: 3, title: 'Principal has seen it and approved', weightHours: 0.5, verifiable: false, waitingOn: 'agency' },

  // ── 4 · People
  { key: '4.1-staff', stage: 4, title: 'Staff accounts created with the right roles', weightHours: 0.5, verifiable: true, waitingOn: 'locare' },
  { key: '4.2-logins', stage: 4, title: 'Every staff member has logged in at least once', weightHours: 0.5, verifiable: true, waitingOn: 'agency' },
  { key: '4.3-training', stage: 4, title: 'Staff trained', detail: 'Never one session. Budget for a second.', weightHours: 1.5, verifiable: false, waitingOn: 'locare' },

  // ── 5 · Data migration — the stage that is a third of the job.
  { key: '5.1-properties', stage: 5, title: 'Properties and units loaded', weightHours: 2.5, verifiable: true, waitingOn: 'locare' },
  { key: '5.2-tenants-leases', stage: 5, title: 'Tenants and leases loaded', weightHours: 2.0, verifiable: true, waitingOn: 'locare' },
  { key: '5.3-fields', stage: 5, title: 'Escalation dates, deposits and deposit location captured', detail: 'The fields that cause month-four problems.', weightHours: 1.0, verifiable: false, waitingOn: 'locare' },
  { key: '5.4-opening-balances', stage: 5, title: 'Opening balances and arrears loaded and signed off', weightHours: 1.0, verifiable: false, waitingOn: 'agency' },
  { key: '5.5-reconciles', stage: 5, title: 'Counts match intake and the ledger nets to zero', weightHours: 0.5, verifiable: true, waitingOn: 'locare' },

  // ── 6 · Money path
  { key: '6.1-method', stage: 6, title: 'Collection method configured', weightHours: 1.0, verifiable: true, waitingOn: 'locare' },
  { key: '6.2-expectations', stage: 6, title: 'Told plainly what is and is not proven', detail: 'No live payment has ever been processed through the collection rail. Say so.', weightHours: 0.5, verifiable: false, waitingOn: 'locare' },
  { key: '6.3-references', stage: 6, title: 'Payment references and mandates in place', weightHours: 0.5, verifiable: true, waitingOn: 'locare' },

  // ── 7 · Dry run
  { key: '7.1-test-invoice', stage: 7, title: 'Test invoice posts and balances', weightHours: 0.7, verifiable: true, waitingOn: 'locare' },
  { key: '7.2-statement', stage: 7, title: 'Owner statement produced and checked', weightHours: 0.5, verifiable: false, waitingOn: 'locare' },
  { key: '7.3-reversed', stage: 7, title: 'Dry-run data reversed out', weightHours: 0.3, verifiable: false, waitingOn: 'locare' },

  // ── 8 · First rent run
  { key: '8.1-run', stage: 8, title: 'First live rent run completed', weightHours: 1.0, verifiable: true, waitingOn: 'locare' },
  { key: '8.2-payment', stage: 8, title: 'One payment reconciled end to end', weightHours: 0.5, verifiable: true, waitingOn: 'locare' },
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
