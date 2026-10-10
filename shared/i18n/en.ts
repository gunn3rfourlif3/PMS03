/**
 * The English catalogue — the SOURCE OF TRUTH for every other locale.
 *
 * Day 1 and Day 2 scope: the shell, the four nav sets and the locale switcher.
 * The per-route sweep is Days 3–5 and adds namespaces below this one; nothing
 * here is a placeholder awaiting translation — this is the wording that ships.
 *
 * Conventions:
 * - Keys are dotted and namespaced by surface then area: `nav.properties`,
 *   `shell.signOut`. The namespace says where a string appears, so a translator
 *   working down the file has the context the English alone does not give.
 * - Nav sets keep SEPARATE keys even where the English matches ("Agencies"
 *   appears in three navs). They are different audiences — staff, partner,
 *   platform admin — and a translation may need to distinguish them. One shared
 *   key would make that impossible to fix later without a sweep.
 * - `{braces}` mark interpolated values. Never translate the brace name.
 * - No string here states a rate, a threshold or an amount.
 */

export const en = {
  // --- Locale switcher -----------------------------------------------------
  'locale.label': 'Language',
  'locale.change': 'Change language',

  // --- Shell chrome --------------------------------------------------------
  'shell.signOut': 'Sign out',
  'shell.openMenu': 'Open menu',
  'shell.closeMenu': 'Close menu',
  'shell.notifications': 'Notifications',
  'shell.splash.blurb':
    '{brand} is a property-management platform for rental agencies — leasing, rent collection, trust accounting, owner payouts and maintenance. Sign in to continue to your back-office.',
  'shell.impersonating':
    'Viewing {agency} as {platform} support — you’re acting on this agency’s live data.',

  // --- Deployment chip -----------------------------------------------------
  'deployment.onsite_backoffice': 'On-site, back office',
  'deployment.onsite_connected': 'On-site, connected',
  'deployment.private_server': 'Private server',

  // --- Staff nav (NAV) -----------------------------------------------------
  'nav.dashboard': 'Dashboard',
  'nav.properties': 'Properties',
  'nav.leases': 'Leases',
  'nav.leaseParsing': 'Import lease',
  'nav.payments': 'Payments',
  'nav.statements': 'Bank statement',
  'nav.listings': 'Listings',
  'nav.applications': 'Applications',
  'nav.owners': 'Owners',
  'nav.agents': 'Agents',
  'nav.providers': 'Providers',
  'nav.reports': 'Reports',
  'nav.documents': 'Documents',
  'nav.inspections': 'Inspections',
  'nav.utilities': 'Utilities',
  'nav.apiKeys': 'API keys',
  'nav.notifications': 'Notifications',
  'nav.messages': 'Messages',
  'nav.billing': 'Billing',
  'nav.settings': 'Settings',

  // --- Owner portal nav (PORTAL_NAV) ---------------------------------------
  'portal.nav.overview': 'Overview',
  'portal.nav.statements': 'Statements',
  'portal.nav.properties': 'Properties',
  'portal.nav.banking': 'Banking',

  // --- Partner nav (PARTNER_NAV) -------------------------------------------
  'partner.nav.overview': 'Overview',
  'partner.nav.pipeline': 'Pipeline',
  'partner.nav.activity': 'Activity',
  'partner.nav.leaderboard': 'Leaderboard',
  'partner.nav.agencies': 'Agencies',
  'partner.nav.commissions': 'Commissions',
  'partner.nav.banking': 'Banking',

  // --- Platform admin nav (ADMIN_NAV) --------------------------------------
  'admin.nav.onboarding': 'Onboarding',
  'admin.nav.agencies': 'Agencies',
  'admin.nav.partners': 'Partners',
  'admin.nav.applications': 'Applications',
  'admin.nav.commissions': 'Commissions',
  'admin.nav.payouts': 'Payout run',
  'admin.nav.billing': 'Billing',
  'admin.nav.imports': 'Import templates',
  'admin.nav.changelog': 'Updates',
  'admin.nav.operators': 'Operators',

  // --- Shared across routes ------------------------------------------------
  // `common.*` is for words that are the SAME action wherever they appear —
  // a modal's Cancel is a modal's Cancel. Anything whose wording could
  // reasonably differ by context keeps its own route-scoped key instead.
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.none': '—',

  // --- /payments -----------------------------------------------------------
  'payments.title': 'Payments',
  'payments.subtitle': 'Review tenant proof-of-payment submissions (manual EFT)',
  'payments.tile.awaiting': 'Awaiting review',
  'payments.tile.value': 'Value in view',
  'payments.tile.submissions': 'Submissions',
  'payments.filter.pending': 'Pending',
  'payments.filter.all': 'All',
  'payments.filter.accepted': 'Accepted',
  'payments.filter.rejected': 'Rejected',
  // The proof's own status, as it reads on the badge. Separate from the filter
  // chips above even though the English matches: a filter is something you
  // click, a status is something a record is, and that is not one word in
  // every language.
  'payments.status.pending': 'Pending',
  'payments.status.accepted': 'Accepted',
  'payments.status.rejected': 'Rejected',
  'payments.tenantFallback': 'Tenant',
  'payments.invoiceLine': 'Invoice {period}',
  'payments.paid': 'Paid',
  'payments.paidAt': 'Date',
  'payments.reference': 'Ref',
  'payments.rejectedNote': 'Rejected: {reason}',
  'payments.accept': 'Accept',
  'payments.reject': 'Reject',
  'payments.empty': 'No proofs of payment.',
  // Two keys rather than one with an interpolated status: "No pending proofs of
  // payment" puts the status mid-sentence, and a language that cannot take an
  // adjective there needs to rewrite the whole line, not fill a slot.
  'payments.emptyFiltered': 'No {status} proofs of payment.',
  'payments.previewTitle': 'Proof of payment',
  'payments.openOriginal': 'Open original',
  'payments.rejectTitle': 'Reject proof of payment',
  'payments.rejectAndNotify': 'Reject & notify',
  'payments.reasonLabel': 'Reason (sent to the tenant)',
  'payments.reasonPlaceholder': "e.g. Amount doesn't match the invoice / reference missing",

  // --- / (dashboard) -------------------------------------------------------
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Portfolio overview — every figure scoped to your vendor',
  'dashboard.period': 'Period',
  'dashboard.refresh': 'Refresh',
  'dashboard.runBilling': 'Run billing',
  'dashboard.collectedFor': 'Collected · {period}',
  'dashboard.ratePill': '{rate}% collected',
  'dashboard.ofBilled': 'of {amount} billed this period',
  'dashboard.collectionRate': 'collection rate',
  'dashboard.onTime': 'on time',
  // Counted: `tn('dashboard.arrears', n)`. English needs two forms; Chinese
  // declares only `other`, which is why the forms live in each catalogue
  // rather than being derived from the English.
  'dashboard.arrears.one': 'Arrears · {count} tenant',
  'dashboard.arrears.other': 'Arrears · {count} tenants',
  'dashboard.outstandingTotal': 'Outstanding total',
  'dashboard.activeLeases': 'Active leases',
  'dashboard.outstandingByAge': 'Outstanding by age',
  'dashboard.reconcilesTo': 'reconciles to {amount}',
  'dashboard.rentRoll': 'Rent roll',
  'dashboard.th.unit': 'Unit',
  'dashboard.th.rent': 'Rent',
  'dashboard.th.status': 'Status',
  'dashboard.th.outstanding': 'Outstanding',
  'dashboard.noLeases': 'No active leases.',
  // Aging buckets. The day ranges are the chart's own axis labels, not a
  // threshold the product asserts, so they stay as written.
  'dashboard.aging.notYetDue': 'Not yet due',
  'dashboard.aging.0-30': '0–30',
  'dashboard.aging.31-60': '31–60',
  'dashboard.aging.61-90': '61–90',
  'dashboard.aging.90plus': '90+',
  'dashboard.status.active': 'active',

  // --- /properties ---------------------------------------------------------
  'properties.title': 'Properties',
  'properties.subtitle': 'Manage your buildings and units',
  'properties.tile.properties': 'Properties',
  'properties.tile.units': 'Units',
  'properties.tile.occupied': 'Occupied',
  'properties.tile.vacant': 'Vacant',
  'properties.add': 'Add property',
  'properties.field.name': 'Name',
  'properties.field.namePlaceholder': 'Sandton Heights',
  'properties.field.type': 'Type',
  'properties.field.ownerOptional': 'Owner (optional)',
  'properties.field.owner': 'Owner',
  'properties.ownerNone': '— none —',
  'properties.addButton': 'Add',
  'properties.units': 'Units',
  'properties.edit': 'Edit',
  'properties.delete': 'Delete',
  'properties.occupiedOf': '{occupied}/{total} occupied',

  // The property `type` enum. Explicit keys, not a prettified enum value: the
  // old `label()` helper turned `single_unit` into "Single Unit" with a string
  // replace, which cannot translate. The enum values themselves are unchanged
  // and still what goes to the API.
  'properties.type.building': 'Building',
  'properties.type.complex': 'Complex',
  'properties.type.single_unit': 'Single unit',
  'properties.type.co_living': 'Co-living',

  // The unit `status` enum, same reasoning.
  'properties.status.vacant': 'Vacant',
  'properties.status.occupied': 'Occupied',
  'properties.status.maintenance': 'Maintenance',
  'properties.status.reserved': 'Reserved',
  'properties.status.offline': 'Offline',

  'properties.unit.label': 'Unit label',
  'properties.unit.labelPlaceholder': 'A-101',
  'properties.unit.status': 'Status',
  'properties.unit.rent': 'Rent',
  'properties.unit.beds': 'Beds',
  'properties.unit.baths': 'Baths',
  'properties.unit.size': 'Size m²',
  'properties.unit.sizePlaceholder': '65',
  'properties.unit.addButton': 'Unit',
  'properties.th.unit': 'Unit',
  'properties.th.status': 'Status',
  'properties.th.rent': 'Rent',
  'properties.th.bedsBathsSize': 'Beds / Baths / m²',
  // Abbreviated on purpose — it sits in a narrow table cell. A locale with no
  // short form should spell it out; the column will widen.
  'properties.unit.bedsBaths': '{beds}bd / {baths}ba',
  'properties.unit.sizeSuffix': '· {size}m²',
  'properties.noUnits': 'No units yet — add one above.',
  'properties.noProperties': 'No properties yet — add one above.',
  'properties.deleteUnitConfirm': 'Delete unit',
  'properties.deletePropertyConfirm': 'Delete property',
  'properties.deleteUnitTitle': 'Delete unit {label}?',
  'properties.deletePropertyTitle': 'Delete {label}?',
  'properties.deletePropertyTitleFallback': 'Delete this property?',
  'properties.deleteUnitMessage': 'The unit will be removed. This is blocked if it has an active lease.',
  'properties.deletePropertyMessage': 'The property will be removed. This is blocked if it still has units.',

  // --- components/pager ----------------------------------------------------
  // Converted on Day 3 rather than Day 5: it hardcoded `toLocaleString('en-ZA')`,
  // and two Day 3 routes use it, so leaving it would have put South African
  // digit grouping under a Chinese page.
  'pager.summary': '{count} {noun} · page {page} of {pages}',
  'pager.previous': 'Previous',
  'pager.next': 'Next',
  'pager.noun.rows': 'rows',

  // --- /leases -------------------------------------------------------------
  'leases.title': 'Leases',
  'leases.subtitle': 'Active leases — add tenants, renew and apply escalation',
  'leases.addTenant': 'Add tenant',
  'leases.pagerNoun': 'leases',
  'leases.tile.active': 'Active leases',
  'leases.tile.rentRoll': 'Monthly rent roll',
  'leases.tile.signed': 'Signed agreements',
  'leases.tile.awaiting': 'Awaiting signature',
  'leases.th.unit': 'Unit',
  'leases.th.rent': 'Rent',
  'leases.th.type': 'Type',
  'leases.th.start': 'Start',
  'leases.th.end': 'End',
  'leases.th.status': 'Status',
  'leases.th.agreement': 'Lease agreement',
  'leases.sendLease': 'Send lease',
  'leases.signed': 'Signed',
  'leases.viewSigned': 'View signed agreement',
  'leases.awaitingSignature': 'Awaiting signature',
  'leases.copySigningLink': 'Copy signing link',
  'leases.openSigningPage': 'Open signing page',
  'leases.renew': 'Renew',
  // "Escalation %" is the field's own name, not a rate the product asserts —
  // the number in the box is the user's input and defaults are theirs to change.
  'leases.escalationPct': 'Escalation %',
  'leases.extendMonths': 'Extend (months)',
  'leases.newRent': 'New rent',
  'leases.applyRenewal': 'Apply renewal',
  'leases.empty': 'No active leases. Use “Add tenant” to onboard your first tenant.',
  'leases.addModalTitle': 'Add tenant',
  'leases.addAndCreate': 'Add tenant & create lease',
  'leases.addBlurb': 'Creates the tenant’s login account (they sign in with their email) and an active lease on the selected unit.',
  'leases.field.fullName': 'Full name',
  'leases.field.fullNamePlaceholder': 'Jane Tenant',
  'leases.field.email': 'Email',
  'leases.field.emailPlaceholder': 'jane@example.com',
  'leases.field.phone': 'Phone (optional)',
  'leases.field.phonePlaceholder': '+27 82 000 0000',
  'leases.field.unit': 'Unit',
  'leases.field.unitPlaceholder': 'Select a unit…',
  // The currency symbol is in the label because the input takes a bare number.
  // It stays "R" in every locale — see the ZAR rule in format.ts.
  'leases.field.rent': 'Monthly rent (R)',
  'leases.field.rentPlaceholder': '8500',
  'leases.field.startDate': 'Start date',
  'leases.field.endDate': 'End date (optional)',
  'leases.field.referredBy': 'Referred by agent (optional)',
  'leases.referredNone': '— none —',

  // --- /statements ---------------------------------------------------------
  'statements.title': 'Bank statement',
  'statements.subtitle': 'Match a statement against open invoices. Nothing is recorded until you say so.',
  // Counted via `tn`.
  'statements.recorded.one': 'Recorded {count} payment.',
  'statements.recorded.other': 'Recorded {count} payments.',
  'statements.someFailed': '{count} could not be recorded.',
  'statements.chooseFile': 'Choose a statement file',
  'statements.reading': 'Reading…',
  'statements.fileHint': 'CSV or Excel, as your bank exports it.',
  'statements.matchedCount': '{matched} of {lines} lines matched',
  'statements.matchedPct': '({pct}%)',
  'statements.toRecord': '{amount} to record',
  'statements.columnsRead': 'Columns read — {columns}.',
  'statements.dateWarning':
    'Check the dates below look right before recording: a month-first export read as day-first is the one mistake this cannot detect.',
  'statements.skippedRows.one': '{count} row could not be read:',
  'statements.skippedRows.other': '{count} rows could not be read:',
  'statements.skippedRow': 'row {row} ({reason})',
  'statements.willBeRecorded': 'Will be recorded',
  'statements.nothingMatched': 'Nothing matched. Check the column mapping above.',
  'statements.byReference': 'by reference',
  'statements.byAmount': 'by amount',
  'statements.include': 'Include',
  'statements.skip': 'Skip',
  'statements.recordButton.one': 'Record {count} payment',
  'statements.recordButton.other': 'Record {count} payments',
  'statements.forYouToResolve': 'For you to resolve',
  'statements.everyLineMatched': 'Every line matched.',
  'statements.notErrors':
    'These are not errors. A statement always carries lines that are not rent, and an ambiguous one is reported rather than guessed at — allocating to the nearer of two identical amounts is how money lands on the wrong tenant.',
  // The unmatched `reason` codes the API sends. An unknown code renders as
  // itself, which is what the old `REASONS[u.reason] ?? u.reason` did.
  'statements.reason.not_a_credit': 'Not a credit',
  'statements.reason.no_candidate': 'No invoice matches',
  'statements.reason.ambiguous_amount': 'Two invoices match this amount',
  'statements.reason.invoice_already_matched': 'That invoice was already matched by another line',

  // --- /utilities ----------------------------------------------------------
  'utilities.title': 'Utilities',
  'utilities.subtitle': 'Municipal meters and readings. Recorded only — nothing here bills a tenant.',
  'utilities.recoveryGap': 'Recovery gap',
  'utilities.addMeter': 'Add meter',

  // The utility kind. Units of measure (kWh, kL, m3) are NOT translated: they
  // are SI-derived symbols and go to the API as written.
  'utilities.kind.electricity': 'Electricity',
  'utilities.kind.water': 'Water',
  'utilities.kind.gas': 'Gas',
  'utilities.kind.sewerage': 'Sewerage',
  'utilities.kind.refuse': 'Refuse',

  'utilities.field.attachedTo': 'Attached to',
  'utilities.attach.unit': 'A unit (submeter)',
  'utilities.attach.property': 'A property (bulk meter)',
  'utilities.field.unit': 'Unit',
  'utilities.field.property': 'Property',
  'utilities.selectPlaceholder': 'Select…',
  'utilities.field.utility': 'Utility',
  'utilities.field.meterNumber': 'Meter number',
  'utilities.field.meterNumberPlaceholder': 'As printed on the meter',
  'utilities.field.dialDigits': 'Dial digits',
  'utilities.field.multiplier': 'Multiplier (CT ratio)',
  'utilities.dialDigitsHint':
    'Dial digits are what makes a rollover computable. Without them a wrapped meter has to be rejected rather than guessed at.',
  'utilities.saveMeter': 'Save meter',
  'utilities.gapBlurb':
    'The bulk municipal meter against the sum of the submeters under it — what was paid for and not recovered.',
  'utilities.gapAllProperties': 'All',
  'utilities.refresh': 'Refresh',
  'utilities.csv': 'CSV',
  'utilities.gapEmpty':
    'Nothing to compare yet. A gap needs a bulk reading and at least one submeter reading in the same month.',
  'utilities.gap.th.period': 'Period',
  'utilities.gap.th.property': 'Property',
  'utilities.gap.th.utility': 'Utility',
  'utilities.gap.th.bulk': 'Bulk',
  'utilities.gap.th.submeters': 'Submeters',
  'utilities.gap.th.gap': 'Gap',
  'utilities.gap.th.gapCost': 'Gap cost',
  'utilities.noMeters': 'No meters yet. Add one to start capturing readings.',
  'utilities.th.where': 'Where',
  'utilities.th.utility': 'Utility',
  'utilities.th.meterNo': 'Meter no.',
  'utilities.capture': 'Capture',
  'utilities.bulkSuffix': '{property} — bulk',
  'utilities.pagerNoun': 'meters',
  'utilities.meterPrefix': 'Meter {serial}.',
  'utilities.previousReading': 'Previous: {reading} on {date}',
  'utilities.noPreviousReading':
    'No previous reading — this one sets the baseline, so it records no consumption.',
  'utilities.field.readingDate': 'Reading date',
  // `{uom}` is the meter's unit symbol, passed through untranslated.
  'utilities.field.reading': 'Reading ({uom})',
  'utilities.field.tariff': 'Tariff per unit',
  'utilities.optional': 'Optional',
  'utilities.field.cost': 'Cost',
  'utilities.costPlaceholderMetered': 'Or leave blank to compute',
  'utilities.costPlaceholderRequired': 'Required',
  'utilities.rolledOver': 'The meter rolled over',
  'utilities.estimatedNotRead': 'Estimated, not read',
  'utilities.field.note': 'Note',
  'utilities.saveReading': 'Save reading',
  'utilities.recentReadings': 'Recent readings',
  'utilities.baseline': 'baseline',
  'utilities.consumption': '{amount} {uom}',
  'utilities.badge.estimated': 'estimated',
  'utilities.badge.rollover': 'rollover',
} as const;
