/**
 * Curated help content, keyed by the route key `routeKeyFor()` produces.
 *
 * The Partner Manual is the source of truth. Question headings are copied from
 * it verbatim; answers are the manual's own wording, trimmed to a sentence or
 * two. Nothing here states a rate, price, cap or window — those live in the
 * manual only, so there is exactly one place to change when they move, and the
 * panel points the reader at the section instead of repeating the number.
 */

/** Path to the manual, relative to the repo root. */
export const MANUAL_PATH = 'docs/manuals/Partner-Manual.md';

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
        a: 'You are holding as many open, unconverted prospects as the portal allows, so it refuses new ones until you close or lose some. Agencies that arrive through your referral link are exempt — those are conversions, not reservations. The manual’s Pipeline section gives the cap.',
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
