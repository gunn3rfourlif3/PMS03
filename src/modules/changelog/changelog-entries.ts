/**
 * What changed, for the people who sell Locare.
 *
 * NOT a technical changelog. A partner does not care that the billing guard now
 * fires on `belowMinimum` rather than `belowFloor`; they care that they can now
 * quote a price for a 45-unit agency. Every entry here should survive the test:
 * *would this change what a partner says on a call, or what they expect to be
 * paid?* If not, it does not belong — an update nobody needed to read teaches
 * people to stop opening the next one.
 *
 * WRITTEN IN THE SAME COMMIT AS THE CHANGE. That is the whole discipline. A
 * changelog maintained separately from the work drifts within a month, which is
 * exactly how the partner introduction email ended up quoting R925 Starter for
 * days after the reprice.
 *
 * Entries are append-only and ids are permanent: the id is how the system knows
 * what has already been emailed. Renaming one re-sends it.
 */

export type ChangelogCategory = 'pricing' | 'product' | 'process' | 'commission';

export interface ChangelogEntry {
  /** Permanent. Changing it makes the system treat this as a new, unsent entry. */
  id: string;
  /** ISO date the change went live. */
  date: string;
  category: ChangelogCategory;
  /** One line, in the language a partner would use. No internal names. */
  title: string;
  /** Two or three sentences. What changed, and what they should do about it. */
  body: string;
  /** Optional: the one thing to do differently. Rendered as a call-out. */
  action?: string;
}

/**
 * A colour per category, so someone scanning on a phone can see which updates
 * touch their money before reading a word. Blue is the brand, green is money,
 * amber is the product, violet is how we work.
 */
export const CATEGORY_COLOR: Record<ChangelogCategory, string> = {
  pricing: '#2D6A8F',
  product: '#E4943A',
  process: '#8A6FB0',
  commission: '#1D9E75',
};

export const CATEGORY_LABEL: Record<ChangelogCategory, string> = {
  pricing: 'Pricing',
  product: 'Product',
  process: 'How we work',
  commission: 'Your commission',
};

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-09-10-custom-tier',
    date: '2026-09-10',
    category: 'pricing',
    title: 'You can now quote a price for agencies under 70 units',
    body:
      'Smaller portfolios used to have no number you could give them, so every one had to come back to Locare. '
      + 'They are now priced at R85.91 per unit per month, excluding VAT — a 45-unit agency is R3,867. '
      + 'It is not on the website and should not be put in writing to anyone who is not the prospect; it is a figure for the conversation.',
    action: 'Re-check any prospect you parked for being too small. Most of them are sellable now.',
  },
  {
    id: '2026-09-10-minimum-units',
    date: '2026-09-10',
    category: 'pricing',
    title: 'There is a 30-unit minimum',
    body:
      'An agency with fewer than 30 units pays as if it had 30 — R2,577 a month excluding VAT. '
      + 'Say it plainly and early: it is a portfolio-size policy, not a penalty, and it exists because onboarding an agency costs the same whether it has twelve units or ninety. '
      + 'An agency of eight units is genuinely too small, and saying so upfront is kinder than a migration neither side enjoys.',
  },
  {
    id: '2026-09-10-setup-fee',
    date: '2026-09-10',
    category: 'pricing',
    title: 'A once-off setup fee of R9,500 now applies',
    body:
      'It covers onboarding — the data migration, the domain work and the training — which costs the same whatever size the agency is. '
      + 'Locare is waiving it for the first ten customers in exchange for a reference and a case study.',
    action: 'Do not promise the waiver yourself. Mention that it exists and escalate.',
  },
  {
    id: '2026-09-09-reprice',
    date: '2026-09-09',
    category: 'commission',
    title: 'Published prices went up, and so did your commission',
    body:
      'Starter is now R6,014, Growth R12,600 and Scale R22,100, all excluding VAT. '
      + 'Introducer commission follows: R481, R1,008 and R1,768 a month respectively, for 24 months. '
      + 'Five Growth agencies is now R5,040 a month rather than R1,065.',
    action: 'Use the new figures. Anything you sent a prospect before the 9th quotes the old ones.',
  },
  {
    id: '2026-09-09-scale-debicheck',
    date: '2026-09-09',
    category: 'product',
    title: 'Scale now includes DebiCheck integration',
    body:
      'At 500 units and above, DebiCheck integration is part of the plan rather than an extra. '
      + 'The agency still holds and pays for its own bureau facility — Locare integrates with it, it does not replace it.',
  },
  {
    id: '2026-09-09-lead-source',
    date: '2026-09-09',
    category: 'process',
    title: '"Where did you hear about us?" on the sign-up forms',
    body:
      'Both the agency and partner sign-up forms now ask how someone found Locare. '
      + 'It is not commission attribution — your referral link is still the only thing that decides that — but it tells us which channels are worth your time.',
  },
];

/** Entries not present in the given set of already-sent ids, newest first. */
export function unsentEntries(sentIds: Iterable<string>): ChangelogEntry[] {
  const sent = new Set(sentIds);
  return CHANGELOG.filter((e) => !sent.has(e.id));
}

export const entryById = (id: string): ChangelogEntry | undefined =>
  CHANGELOG.find((e) => e.id === id);
