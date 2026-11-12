import type { MessageKey } from '@shared/i18n';
import type { AssistantEntry } from './content';

/**
 * Help content for the AGENCY back office, keyed by route.
 *
 * TWO DIFFERENCES FROM `content.ts`, both deliberate.
 *
 * 1. These entries hold i18n KEYS, not prose. The partner panel ships English
 *    literals because the partner surface is English-only; the agency back
 *    office carries a language switcher, and help that stays English while the
 *    rest of the screen turns to Chinese is worse than no help. Keys mean the
 *    catalogue's own fallback applies per string, so a half-translated panel
 *    degrades to English rather than breaking.
 *
 * 2. `docs/manuals/Staff-Web-Manual.md` is the source, not the Partner Manual,
 *    and there is no route serving it yet — so these entries carry no anchor
 *    and the panel names the file instead of linking to it. A dead link in a
 *    client demo is worse than a file path.
 *
 * THE RULE FROM content.ts STILL HOLDS: an answer may lose words or change
 * voice against the manual, it may never gain a fact, figure, rate or
 * threshold the manual lacks. Nothing here states a rate, price or threshold.
 */

export const STAFF_MANUAL_PATH = 'docs/manuals/Staff-Web-Manual.md';

export type AgencyQuestionKeys = { qKey: MessageKey; aKey: MessageKey };

export type AgencyEntryKeys = {
  titleKey: MessageKey;
  purposeKey: MessageKey;
  questions: AgencyQuestionKeys[];
  /** Section name in the staff manual, for the pointer line. */
  manualSection: string;
};

export const AGENCY_CONTENT: Record<string, AgencyEntryKeys> = {
  '/': {
    titleKey: 'assistant.dashboard.title',
    purposeKey: 'assistant.dashboard.purpose',
    questions: [
      { qKey: 'assistant.dashboard.q1', aKey: 'assistant.dashboard.a1' },
      { qKey: 'assistant.dashboard.q2', aKey: 'assistant.dashboard.a2' },
    ],
    manualSection: 'Dashboard',
  },

  '/properties': {
    titleKey: 'assistant.properties.title',
    purposeKey: 'assistant.properties.purpose',
    questions: [
      { qKey: 'assistant.properties.q1', aKey: 'assistant.properties.a1' },
      { qKey: 'assistant.properties.q2', aKey: 'assistant.properties.a2' },
    ],
    manualSection: 'Properties & Units',
  },

  '/leases': {
    titleKey: 'assistant.leases.title',
    purposeKey: 'assistant.leases.purpose',
    questions: [
      { qKey: 'assistant.leases.q1', aKey: 'assistant.leases.a1' },
      { qKey: 'assistant.leases.q2', aKey: 'assistant.leases.a2' },
    ],
    manualSection: 'Leases',
  },

  '/utilities': {
    titleKey: 'assistant.utilities.title',
    purposeKey: 'assistant.utilities.purpose',
    questions: [
      { qKey: 'assistant.utilities.q1', aKey: 'assistant.utilities.a1' },
      { qKey: 'assistant.utilities.q2', aKey: 'assistant.utilities.a2' },
      { qKey: 'assistant.utilities.q3', aKey: 'assistant.utilities.a3' },
    ],
    manualSection: 'Utilities',
  },
};

/** The agency route key: the first path segment, or `/` for the dashboard. */
export function agencyRouteKeyFor(path: string): string {
  const [, section] = path.split('/');
  return section ? `/${section}` : '/';
}

/**
 * Resolve an agency entry to rendered strings, or null when the route has no
 * curated content. Null rather than a fallback: the panel decides whether an
 * uncurated route is worth showing a button for at all.
 */
export function agencyContentFor(
  path: string,
  t: (key: MessageKey) => string,
): AssistantEntry | null {
  const entry = AGENCY_CONTENT[agencyRouteKeyFor(path)];
  if (!entry) return null;
  return {
    title: t(entry.titleKey),
    purpose: t(entry.purposeKey),
    questions: entry.questions.map((q) => ({ q: t(q.qKey), a: t(q.aKey) })),
    manualAnchor: '',
    manualSection: entry.manualSection,
  };
}
