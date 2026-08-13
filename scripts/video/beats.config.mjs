/**
 * Beat definitions for the Locare marketing video.
 *
 * Each beat becomes one clip. The recorder drives these in order, moving a
 * synthetic cursor between targets so the capture looks hand-driven.
 *
 * SELECTORS ARE THE FRAGILE PART. They're all in this one file precisely so a
 * UI change means editing here, not the recorder. Run with DEBUG=1 to have the
 * recorder report which selectors it couldn't find, then fix them here.
 *
 * `text=` selectors are Playwright's text engine and survive restyling better
 * than CSS class chains — prefer them.
 */

export const BEATS = [
  {
    id: '01-dashboard',
    caption: 'One place for the whole portfolio.',
    seconds: 5,
    goto: '/',
    actions: [
      { wait: 1200 },
      { scroll: 320 },
      { wait: 900 },
    ],
  },
  {
    id: '02-rent-run',
    caption: 'Invoices raise themselves. Every unit, every month.',
    seconds: 7,
    actions: [
      { click: 'text=Leases', label: 'Leases nav' },
      { wait: 1400 },
      { scroll: 260 },
      { wait: 1200 },
    ],
  },
  {
    id: '03-payments-unpaid',
    caption: 'Rent due, tracked to the cent.',
    seconds: 6,
    actions: [
      { click: 'text=Payments', label: 'Payments nav' },
      { wait: 1600 },
      { scroll: 200 },
      { wait: 1000 },
    ],
  },
  {
    id: '04-tenant-phone',
    caption: 'Your tenant pays from their phone.',
    seconds: 7,
    device: 'mobile',           // recorded at 390x844, composited as a device frame later
    goto: process.env.TENANT_URL || 'http://localhost:8081',
    actions: [
      { wait: 1800 },
      { scroll: 200 },
      { wait: 1400 },
    ],
  },
  {
    id: '05-reconcile',
    caption: 'It reconciles itself.',
    seconds: 8,               // the money shot — hold longer than feels natural
    goto: '/payments',
    actions: [
      { wait: 2000 },
      { scroll: 240 },
      { wait: 2200 },
    ],
  },
  {
    id: '06-owner-statement',
    caption: 'Owner statements build themselves.',
    seconds: 7,
    actions: [
      { click: 'text=Owners', label: 'Owners nav' },
      { wait: 1600 },
      { scroll: 300 },
      { wait: 1400 },
    ],
  },
  {
    id: '07-reports',
    caption: 'Every cent accounted for.',
    seconds: 6,
    actions: [
      { click: 'text=Reports', label: 'Reports nav' },
      { wait: 2200 },
      { scroll: 260 },
      { wait: 1000 },
    ],
  },
];

/**
 * The white-label beat. The recorder loads the same page once per brand, so the
 * only thing that changes between frames is the identity — which is the whole
 * point of the shot. Add prospects here to generate a personalised demo.
 */
export const BRANDS = [
  { id: 'a', host: process.env.DEMO_HOST_A || 'localhost:3001' },
  { id: 'b', host: process.env.DEMO_HOST_B || '' },
  { id: 'c', host: process.env.DEMO_HOST_C || '' },
].filter((b) => b.host);

export const CARDS = [
  { id: '00-intro', key: '1', seconds: 3 },
  { id: '99-outro', key: '2', seconds: 4 },
];
