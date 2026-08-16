/**
 * Beat definitions for the Locare marketing video.
 *
 * Each beat becomes one clip. The recorder drives these in order, moving a
 * synthetic cursor between targets so the capture looks hand-driven.
 *
 * SELECTORS: nav links are matched by `a[href="/x"]` rather than link text.
 * Routes almost never change; labels and CSS classes do. Each navigating beat
 * also carries `fallbackGoto` — if the click misses, the recorder navigates
 * directly so the beat still films the right screen instead of the last one.
 *
 * EACH BEAT RECORDS IN ITS OWN BROWSER CONTEXT — that's how Playwright produces
 * one video file per clip. A beat therefore always starts from a blank page and
 * MUST declare `goto`. A beat that only clicks a nav link finds nothing, because
 * there's no page loaded to click on. Beats that navigate start on the previous
 * screen so the click reads as a natural journey.
 *
 * Verified against web-admin/components/shell.tsx NAV.
 * Run with DEBUG=1 to see which selectors resolved.
 */

export const BEATS = [
  {
    id: '01-dashboard',
    caption: 'One place for the whole portfolio.',
    goto: '/',
    actions: [
      { wait: 1400 },
      { scroll: 320 },
      { wait: 1000 },
    ],
  },
  {
    id: '02-rent-run',
    caption: 'Invoices raise themselves. Every unit, every month.',
    goto: '/',                 // start on the dashboard so the sidebar is there to click
    fallbackGoto: '/leases',
    actions: [
      { click: 'a[href="/leases"]', label: 'Leases nav' },
      { wait: 1600 },
      { scroll: 260 },
      { wait: 1200 },
    ],
  },
  {
    id: '03-payments-unpaid',
    // /payments is the proof-of-payment review queue. seed-video-extras.ts puts
    // pending proofs in it so this films a real queue, not an empty state.
    caption: 'Tenants send proof. It lands in one queue.',
    goto: '/leases',
    fallbackGoto: '/payments',
    actions: [
      { click: 'a[href="/payments"]', label: 'Payments nav' },
      { wait: 2000 },
      { scroll: 180 },
      { wait: 1200 },
    ],
  },
  {
    id: '04-tenant-phone',
    // Signed in as a tenant with a due invoice, so this films the actual app —
    // rent owing, pay button — rather than a login form.
    app: 'tenant',
    caption: 'Your tenant pays from their phone.',
    optional: true,             // Expo is the flakiest dependency; skip, don't fail
    actions: [
      { wait: 2600 },
      { scroll: 220 },
      { wait: 1600 },
    ],
  },
  {
    id: '05-reconcile',
    // The money shot, and it's a real one: Accept calls recordManual(), which
    // allocates the payment against the invoice and posts it to the double-entry
    // ledger. The row leaves the pending queue on camera. Hold afterwards —
    // this is the thing no spreadsheet can do.
    caption: 'One click. It reconciles itself.',
    goto: '/payments',
    actions: [
      { wait: 2000 },
      // text-is, not has-text: the page also has an "Accepted" filter tab, and
      // has-text matches substrings — so the money shot clicked the filter and
      // filmed an empty "No accepted proof of payment" state instead of a
      // reconciliation.
      { click: 'button:text-is("Accept")', label: 'Accept proof' },
      { wait: 2600 },   // let the row disappear and the count update
      { scroll: 160 },
      { wait: 1600 },
    ],
  },
  {
    id: '06-owner-statement',
    caption: 'Owner statements build themselves.',
    goto: '/payments',
    fallbackGoto: '/owners',
    actions: [
      { click: 'a[href="/owners"]', label: 'Owners nav' },
      { wait: 1800 },
      { scroll: 300 },
      { wait: 1400 },
    ],
  },
  {
    id: '07-reports',
    caption: 'Every cent accounted for.',
    goto: '/owners',
    fallbackGoto: '/reports',
    actions: [
      { click: 'a[href="/reports"]', label: 'Reports nav' },
      // The income statement and charts are the strongest proof in the product,
      // so this beat is deliberately the longest — recharts animates in, then we
      // walk down through the numbers rather than snatching a glance.
      { wait: 3200 },
      { scroll: 220 },
      { wait: 2400 },
      { scroll: 260 },
      { wait: 2400 },
      { scroll: 220 },
      { wait: 2200 },
    ],
  },
];

/**
 * The white-label beat. The recorder loads the same page once per brand, so the
 * only thing that changes between frames is the identity — which is the whole
 * point of the shot. Add a prospect's host here to generate a personalised demo.
 */
// The owner's view. Same platform, third audience: this is what makes the
// "everyone gets their own app" claim visible rather than asserted.
BEATS.push(
  {
    id: '08-landlord-home',
    app: 'landlord',
    caption: 'Owners watch their portfolio live.',
    optional: true,
    actions: [
      { wait: 2600 },
      { scroll: 240 },
      { wait: 1600 },
    ],
  },
  {
    id: '09-landlord-statements',
    app: 'landlord',
    caption: 'Applications, approved on the move.',
    optional: true,
    actions: [
      { wait: 2000 },
      { click: 'text="Approvals"', label: 'Approvals tab' },
      { wait: 2200 },
      { scroll: 200 },
      { wait: 1400 },
    ],
  },
  {
    id: '10-tenant-maintenance',
    app: 'tenant',
    caption: 'Maintenance, logged from the couch.',
    optional: true,
    actions: [
      { wait: 2000 },
      // Home-screen tile, not a tab: Maintenance is a stack screen reached from
      // the "Log ticket" tile (mobile-tenant/src/screens/HomeScreen.tsx).
      // The tile label is "Log" with a "Maintenance" sub-label since the bento
      // redesign; testID is used because copy changes break text selectors and
      // this beat silently filmed the home screen for a whole run.
      { click: '[data-testid="tile-maintenance"]', label: 'Maintenance tile' },
      { wait: 2400 },
      { scroll: 220 },
      { wait: 1600 },
    ],
  },
  {
    id: '11-tenant-messages',
    app: 'tenant',
    caption: 'One thread. No more lost WhatsApps.',
    optional: true,
    actions: [
      { wait: 2000 },
      { click: '[data-testid="tile-messages"]', label: 'Messages tile' },
      { wait: 2400 },
      { scroll: 180 },
      { wait: 1600 },
    ],
  },
  {
    id: '12-landlord-tickets',
    app: 'landlord',
    caption: 'Work orders, assigned and tracked.',
    optional: true,
    actions: [
      { wait: 2000 },
      // The tab is titled "Maintenance" even though the screen is TicketsScreen
      // (see mobile-landlord/App.tsx).
      { click: 'text="Maintenance"', label: 'Maintenance tab' },
      { wait: 2400 },
      { scroll: 220 },
      { wait: 1600 },
    ],
  },
  {
    id: '16-tenant-pay',
    app: 'tenant',
    caption: 'Rent due, paid in two taps.',
    optional: true,
    actions: [
      { wait: 2000 },
      { click: '[data-testid="tile-pay"]', label: 'Pay tile' },
      { wait: 2600 },
      { scroll: 200 },
      { wait: 2000 },
    ],
  },
  {
    id: '17-tenant-lease',
    app: 'tenant',
    // seed-video-extras.ts signs a lease agreement for this tenant, so the
    // Documents tab has something real rather than an empty state.
    caption: 'Their lease, always to hand.',
    optional: true,
    actions: [
      { wait: 2000 },
      { click: '[data-testid="tile-lease"]', label: 'Lease tile' },
      { wait: 2600 },
      { scroll: 200 },
      { wait: 2000 },
    ],
  },
  {
    id: '18-landlord-messages',
    app: 'landlord',
    caption: 'Every conversation, in one inbox.',
    optional: true,
    actions: [
      { wait: 2000 },
      { click: 'text="Messages"', label: 'Messages tab' },
      { wait: 2600 },
      { scroll: 200 },
      { wait: 2000 },
    ],
  },
  {
    id: '13-listings',
    caption: 'Your own branded rentals site.',
    goto: '/listings',
    actions: [
      { wait: 2200 },
      { scroll: 300 },
      { wait: 1600 },
    ],
  },
  {
    id: '14-applications',
    caption: 'Applications arrive as a pipeline, not an inbox.',
    goto: '/listings',
    fallbackGoto: '/applications',
    actions: [
      { click: 'a[href="/applications"]', label: 'Applications nav' },
      { wait: 2200 },
      { scroll: 260 },
      { wait: 1600 },
    ],
  },
  {
    id: '15-documents',
    caption: 'Leases signed and stored, not chased.',
    goto: '/applications',
    fallbackGoto: '/documents',
    actions: [
      { click: 'a[href="/documents"]', label: 'Documents nav' },
      { wait: 2200 },
      { scroll: 240 },
      { wait: 1400 },
    ],
  },
);

export const BRANDS = [
  { id: 'a', host: process.env.DEMO_HOST_A || 'localhost:3001' },
  { id: 'b', host: process.env.DEMO_HOST_B || '' },
  { id: 'c', host: process.env.DEMO_HOST_C || '' },
].filter((b) => b.host);

export const CARDS = [
  { id: '00-intro', key: '1', seconds: 3 },
  { id: '99-outro', key: '2', seconds: 4 },
];
