/**
 * "Where did you hear about us?" — self-reported acquisition source.
 *
 * Single source of truth for the API's validation. The marketing site is static
 * HTML and necessarily repeats this list in `marketing/index.html`; if you add
 * an option, add it in both or the form will post a value the API rejects.
 *
 * `partner` is self-reported marketing attribution and carries NO commission
 * entitlement. Real attribution is `vendor_subscriptions.referred_by_partner_id`,
 * set only by a referral code or a partner-created agency, and governed by the
 * first-recorded-wins rule in docs/LOCARE_COMMISSION_STRUCTURE.md §4.2. Someone
 * ticking "a Locare partner" here must never cause a payout.
 */
export const LEAD_SOURCES = [
  'google',
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'referral',
  'partner',
  'event',
  'other',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Labels for admin lists and notification emails. */
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  google: 'Google / search',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  referral: 'Word of mouth',
  partner: 'A Locare partner',
  event: 'Industry event or group',
  other: 'Other',
};

export const sourceLabel = (s?: string | null): string =>
  (s && LEAD_SOURCE_LABELS[s as LeadSource]) || '—';
