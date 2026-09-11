/**
 * Who gets a changelog email, and the rules for cleaning that list up.
 *
 * Pure, so the rules are testable without a database. The queries that feed it
 * live in the service; everything that decides whether an address is safe to
 * mail lives here.
 */

export interface Recipient {
  email: string;
  /** Where the address came from. Shown in the preview so the count is legible. */
  source: 'partner' | 'applicant' | 'admin' | 'extra';
}

/** Deliberately loose: this rejects obvious rubbish, not unusual-but-valid mail. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

/**
 * Reserved TLDs that can never resolve (RFC 2606 / 6761).
 *
 * The demo agencies use `.invalid` addresses precisely so nothing can reach a
 * person. Filtering them here means a seeded fixture can never appear in a real
 * send, however the recipient queries change later.
 */
const UNREACHABLE = /\.(invalid|test|example|localhost)$/i;

/**
 * One address per person, first source wins.
 *
 * Order matters because the sources overlap: an approved applicant IS a partner
 * — `approve()` creates the partner row — so the same address arrives twice and
 * should be counted once, as a partner.
 */
export function dedupeRecipients(lists: Recipient[]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const r of lists) {
    const email = (r.email ?? '').trim();
    if (!email || !LOOKS_LIKE_EMAIL.test(email) || UNREACHABLE.test(email)) continue;
    const key = email.toLowerCase();
    if (!seen.has(key)) seen.set(key, { email, source: r.source });
  }
  return [...seen.values()];
}

/** Split a comma or semicolon separated env var into recipients. */
export function fromEnvList(raw: string | undefined, source: Recipient['source']): Recipient[] {
  return (raw ?? '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email, source }));
}

/** Counts by source, for the preview: "12 partners, 3 applicants, 1 admin". */
export function countBySource(rs: Recipient[]): Record<Recipient['source'], number> {
  const out: Record<Recipient['source'], number> = { partner: 0, applicant: 0, admin: 0, extra: 0 };
  for (const r of rs) out[r.source] += 1;
  return out;
}
