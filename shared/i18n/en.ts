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
} as const;
