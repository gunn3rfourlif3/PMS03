/**
 * Pure partner-commission maths. Recurring % of a referred agency's MRR.
 * Window: null commissionMonths = lifetime; otherwise accrue only for the first
 * N calendar months from the subscription start.
 */
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function commissionAmount(mrr: number, rate: number): number {
  return round2((Number(mrr) || 0) * (Number(rate) || 0));
}

/** Whole calendar months between a start date and a 'YYYY-MM' period (>= 0). */
export function monthsElapsed(startedAt: Date | string, period: string): number {
  const s = new Date(startedAt);
  const [y, m] = period.split('-').map(Number);
  return (y - s.getUTCFullYear()) * 12 + (m - 1 - s.getUTCMonth());
}

export function withinWindow(startedAt: Date | string, period: string, commissionMonths?: number | null): boolean {
  const elapsed = monthsElapsed(startedAt, period);
  if (elapsed < 0) return false;                    // period before the sub started
  if (commissionMonths == null) return true;        // lifetime
  return elapsed < commissionMonths;                // first N months only
}
