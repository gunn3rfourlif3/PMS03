/**
 * Curated help content, keyed by the route key `routeKeyFor()` produces.
 *
 * The Partner Manual is the source of truth. Question headings are the manual's
 * own; answers are the manual's wording, shortened and re-voiced as page help
 * under the Phase 2 amendment (2026-10-05) — an answer may lose words or
 * change voice, it may never gain a fact, figure, rate or threshold the manual
 * lacks, and removing words cannot add a claim. Nothing here states a rate,
 * price, cap or window — those live in the manual only, so there is exactly
 * one place to change when they move, and the panel points the reader at the
 * section instead of repeating the number.
 */

/** Path to the manual, relative to the repo root. */
export const MANUAL_PATH = 'docs/manuals/Partner-Manual.md';

/**
 * The partner route that serves the manual. Added in Phase 2 Day 8 under the
 * amendment allowing one new partner route for the manual only. Deliberately
 * not in `PARTNER_NAV` — it is reached from this panel.
 */
export const MANUAL_ROUTE = '/partner/manual';

/**
 * The anchor id the manual route gives a heading. Kept here, next to the
 * `manualAnchor` values, so the panel's links and the route's ids cannot drift
 * apart: both sides slug the same way.
 */
export function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Link to an entry's manual section. Falls back to the top of the manual when
 * the entry names no section, which is what the generic fallback entry does.
 */
export function manualHref(entry: Pick<AssistantEntry, 'manualAnchor'>): string {
  return `${MANUAL_ROUTE}${entry.manualAnchor}`;
}

export type AssistantQuestion = { q: string; a: string };

export type AssistantEntry = {
  /** Panel heading for this route. */
  title: string;
  /** One line on what the page is for. */
  purpose: string;
  questions: AssistantQuestion[];
  /** Heading anchor of the matching manual section, e.g. `#pipeline`. */
  manualAnchor: string;
  /** Human-readable name of that section, for the "see the manual" line. */
  manualSection: string;
};

export const ASSISTANT_CONTENT: Record<string, AssistantEntry> = {
  '/partner': {
    title: 'Overview',
    purpose:
      'Your landing screen: pipeline value, active deals, agencies signed, demos this week, commission month-to-date, and recent activity.',
    questions: [
      {
        q: 'What is pipeline value?',
        a: 'The sum of expected monthly subscription across your open deals. It is your own estimate, not a Locare forecast, and it changes when you edit a deal’s expected MRR.',
      },
      {
        q: 'Why is commission month-to-date lower than I expected?',
        a: 'It counts what has accrued so far this month, and commission accrues only on money the agency has actually paid. See the Commissions section of the manual.',
      },
    ],
    manualAnchor: '#overview',
    manualSection: 'Overview',
  },

  '/partner/pipeline': {
    title: 'Pipeline',
    purpose:
      'Where prospects live before they become agencies, moving through Lead, Contacted, Demo, Trial, Proposal, Won and Lost.',
    questions: [
      {
        q: 'What do I need to add a deal?',
        a: 'Agency or prospect name, contact name, contact email, expected units and expected MRR.',
      },
      {
        q: 'Why won’t it let me add another?',
        a: 'You are holding as many open, unconverted prospects as the portal allows, so it refuses new ones until you close or lose some — though agencies that arrive through your referral link are exempt. The manual’s Pipeline section gives the cap.',
      },
      {
        q: 'When should I log a prospect?',
        a: 'The day you speak to them, not the day they show interest. Attribution goes to the first recorded contact, it is set once and never changes, and the manual’s Pipeline section gives the window it has to fall inside.',
      },
      {
        q: 'What happens when I mark one Won?',
        a: 'The deal links to the created agency, and commission takes over from there on that agency’s actual payments.',
      },
      {
        q: 'Do I have to give a reason when I mark one Lost?',
        a: 'Yes, and answer honestly. It is the only data anyone has about why deals fail, and it feeds back into the curriculum you were trained on.',
      },
    ],
    manualAnchor: '#pipeline',
    manualSection: 'Pipeline',
  },
  '/partner/agencies': {
    title: 'Agencies',
    purpose:
      'The agencies attributed to you, with their tier, unit count, status and join date \u2014 and your referral link.',
    questions: [
      {
        q: 'How does an agency become mine?',
        a: 'Two ways, and only two: your referral link \u2014 automatic and unambiguous, so prefer it and send the link \u2014 or a named registered prospect logged in your pipeline with an agency name and a named contact, which Locare confirms is a genuine introduction. Saying you spoke to someone first is not attribution.',
      },
      {
        q: 'Two of us spoke to the same agency. Who earns?',
        a: 'Whoever recorded it first, inside the window the manual\u2019s Agencies section gives. That is the whole rule, and it is why you log on the day of the call.',
      },
      {
        q: 'What can I see inside one of my agencies?',
        a: 'Their name, tier, unit count, subscription and status. Nothing else \u2014 no tenants, no leases, no financials, no landlord details, not available to your login at all.',
      },
      {
        q: 'A prospect asked whether I can see their tenants.',
        a: 'You cannot, and saying so plainly is the strongest answer: your access shows that they are a customer and what plan they are on, not their tenants and not their money.',
      },
    ],
    manualAnchor: '#agencies',
    manualSection: 'Agencies',
  },

  '/partner/commissions': {
    title: 'Commissions',
    purpose:
      'Every accrual, by period, with the agency, the basis MRR, your rate, the amount and its status \u2014 and totals for pending, paid this month and paid to date.',
    questions: [
      {
        q: 'What is commission calculated on?',
        a: 'The referred agency\u2019s recurring subscription revenue, excluding VAT. Once-off and pass-through charges are excluded.',
      },
      {
        q: 'When does it accrue?',
        a: 'Only on payments actually received from the agency, in the month they are received. Nothing accrues on an invoice that has been raised but not paid.',
      },
      {
        q: 'Why not pay on billing instead?',
        a: 'Commission is paid in arrears on collected revenue so that clawbacks never arise — recovering money already paid to a partner is the fastest way to poison a channel.',
      },
      {
        q: 'When am I paid?',
        a: 'A statement comes first and the payout follows, both for the prior month. The manual\u2019s Commissions section gives the two dates.',
      },
      {
        q: 'Nothing was paid out this month.',
        a: 'Below a minimum balance the amount rolls over, and is swept quarterly regardless \u2014 so it is delayed, never lost. The manual\u2019s Commissions section gives the minimum.',
      },
      {
        q: 'What do the statuses mean?',
        a: '`pending` \u2014 accrued, not yet approved. `approved` \u2014 confirmed, due in the next run. `paid` \u2014 sent. `cancelled` \u2014 reversed before payment, when the underlying payment was reversed or the accrual was found not to be commissionable.',
      },
      {
        q: 'What is my rate?',
        a: 'It follows your tier, and your current rate is shown on every line on this screen. The rate ladder and the qualification gates live in the commission structure document the manual points to \u2014 that is the source of truth, and neither the manual nor this panel restates the numbers.',
      },
      {
        q: 'How long does it run?',
        a: 'Introducer accruals run for a fixed term per agency; Partner and Reseller are lifetime, for as long as that agency keeps paying. The manual\u2019s Commissions section gives the term.',
      },
      {
        q: 'Can I earn on my own agency?',
        a: 'No \u2014 not on yours, nor any entity where you or an immediate family member is a director, member or beneficial owner, nor any agency under common control with one of those; it is checked at approval and again at accrual. If you run an agency and want to use Locare you are welcome to, paying for it like any other customer.',
      },
    ],
    manualAnchor: '#commissions',
    manualSection: 'Commissions',
  },

  '/partner/activity': {
    title: 'Activity',
    purpose:
      'A log of your calls, emails, demos, notes and stage changes.',
    questions: [
      {
        q: 'Is this busywork?',
        a: 'No \u2014 it is the evidence behind a promotion to Partner, and it is what the leaderboard is computed from. A demo nobody recorded did not happen as far as your tier is concerned.',
      },
      {
        q: 'What counts as an activity?',
        a: 'Call, email, demo, note, stage change, signup. Stage changes and signups are recorded for you; the rest you log.',
      },
    ],
    manualAnchor: '#activity',
    manualSection: 'Activity',
  },

  '/partner/banking': {
    title: 'Banking',
    purpose:
      'Where your payout account lives. Enter it once, and confirm it after any change at your bank.',
    questions: [
      {
        q: 'Why has my payout not arrived?',
        a: 'Missing or stale banking details are the most common reason. A payout run cannot include an account it does not have.',
      },
      {
        q: 'Who can see these details?',
        a: 'They are encrypted at rest and masked in admin views, the same as your KYC documents.',
      },
    ],
    manualAnchor: '#banking',
    manualSection: 'Banking',
  },

  '/partner/leaderboard': {
    title: 'Leaderboard',
    purpose:
      'Other partners\u2019 display names, headline metric, rank and movement.',
    questions: [
      {
        q: 'What can other partners see about me?',
        a: 'Your display name, your headline metric, your rank and your streak. Never your pipeline, your contacts, your agencies or your banking.',
      },
    ],
    manualAnchor: '#leaderboard',
    manualSection: 'Leaderboard',
  },
};

/**
 * Generic entry for a route with no curated content yet. Never returns null:
 * an empty panel reads as a broken panel, so the fallback names the manual.
 */
export const FALLBACK_ENTRY: AssistantEntry = {
  title: 'Help',
  purpose:
    'There is no page-specific guidance for this screen yet. The Partner Manual covers every part of the portal.',
  questions: [],
  manualAnchor: '',
  manualSection: 'Partner Manual',
};

export function contentFor(routeKey: string): AssistantEntry {
  return ASSISTANT_CONTENT[routeKey] ?? FALLBACK_ENTRY;
}
