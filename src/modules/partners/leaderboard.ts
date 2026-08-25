/**
 * Pure leaderboard shaping. Kept out of the service so the privacy rule and the
 * Reseller-gate arithmetic can be tested without a database.
 *
 * The board ranks on cash collected (docs/LOCARE_COMMISSION_STRUCTURE.md §4),
 * not subscribed MRR, so it agrees with what a partner is actually paid.
 */

export type LeaderboardWindow = 'month' | 'quarter' | 'all';

export const LEADERBOARD_WINDOWS: LeaderboardWindow[] = ['month', 'quarter', 'all'];

export function isLeaderboardWindow(s: unknown): s is LeaderboardWindow {
  return typeof s === 'string' && (LEADERBOARD_WINDOWS as string[]).includes(s);
}

/** Reseller gate: R15,000/month collected for three consecutive months (§1). */
export const RESELLER_GATE_MONTHLY = 15000;
export const RESELLER_GATE_MONTHS = 3;

export interface LeaderboardRow {
  rank: number;
  name: string;
  partnerId: string | null;
  isSelf: boolean;
  prevRank: number | null;
  liveAgencies: number;
  /** Months with collected revenue, of the last three. Not a lifetime streak. */
  activeMonths: number;
  /** Rand figures are null for everyone except the caller — enforced in SQL. */
  collected: number | null;
  collected3m: number | null;
  qualifyingMonths: number | null;
}

export type Movement = 'up' | 'down' | 'same' | 'new';

/**
 * Rank movement against the previous period. A smaller rank number is better,
 * so an improvement is prevRank > rank — easy to invert by accident, which is
 * why it lives here with a test rather than inline in a template.
 */
export function movement(rank: number, prevRank: number | null | undefined): Movement {
  if (prevRank == null) return 'new';
  if (prevRank > rank) return 'up';
  if (prevRank < rank) return 'down';
  return 'same';
}

export interface GateProgress {
  /** 0–1, for a progress ring. Capped at 1 so an over-achiever doesn't overflow. */
  fraction: number;
  monthsMet: number;
  monthsNeeded: number;
  /** Rands still to collect this month to put the current month over the line. */
  shortfallThisMonth: number;
  qualified: boolean;
}

/**
 * Progress toward the Reseller rate, expressed as months met rather than rands
 * banked. Three months at R15,000 is not the same as one month at R45,000, and
 * a bar that filled on the latter would be lying about a promotion.
 */
export function gateProgress(
  qualifyingMonths: number | null | undefined,
  collectedThisMonth: number | null | undefined,
): GateProgress {
  const met = Math.max(0, Math.min(RESELLER_GATE_MONTHS, Number(qualifyingMonths) || 0));
  const thisMonth = Math.max(0, Number(collectedThisMonth) || 0);
  return {
    fraction: met / RESELLER_GATE_MONTHS,
    monthsMet: met,
    monthsNeeded: RESELLER_GATE_MONTHS - met,
    shortfallThisMonth: Math.max(0, RESELLER_GATE_MONTHLY - thisMonth),
    qualified: met >= RESELLER_GATE_MONTHS,
  };
}

/**
 * Guard against a rand figure escaping to the wrong partner. The SQL already
 * scopes this; a caller could still hand the rows on to the wrong recipient, so
 * the service asserts with this before responding.
 */
export function leaksOtherPartnersMoney(rows: LeaderboardRow[]): boolean {
  return rows.some(
    (r) => !r.isSelf && (r.collected != null || r.collected3m != null || r.partnerId != null),
  );
}

/**
 * The three podium places plus the caller's own row when they placed outside it.
 * Returning the caller separately means the UI never has to hunt the table for
 * "where am I", which is the first thing anyone looks for.
 */
export function podium(rows: LeaderboardRow[]): { top: LeaderboardRow[]; self: LeaderboardRow | null } {
  const top = rows.slice(0, 3);
  const self = rows.find((r) => r.isSelf) ?? null;
  return { top, self: self && !top.includes(self) ? self : null };
}
