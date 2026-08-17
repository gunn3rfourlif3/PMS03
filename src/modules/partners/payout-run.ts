/**
 * Pure payout-run logic — the minimum-payout floor and the quarterly sweep.
 * See docs/LOCARE_COMMISSION_STRUCTURE.md §4.1.
 *
 * Amounts here are rands with two decimals, matching `partner_commissions.amount`.
 * This is not ledger money — no partner payout posts to the double-entry ledger —
 * so the cents-as-integers rule does not apply.
 */

/** Rands. Low enough that an Introducer on one Starter agency waits ~4 months, not 7. */
export const PAYOUT_FLOOR_DEFAULT = 250;

export type PayoutReason = 'floor_met' | 'quarterly_sweep' | 'below_floor' | 'nothing_due';

/**
 * March, June, September, December. The sweep runs on the payout for those
 * months so no partner waits longer than a quarter for money already earned —
 * the floor exists to avoid R12 EFTs, not to sit on balances.
 */
export function isQuarterEnd(d: Date): boolean {
  return [2, 5, 8, 11].includes(d.getMonth());
}

export function payoutDecision(
  total: number,
  floor: number = PAYOUT_FLOOR_DEFAULT,
  quarterEnd = false,
): { payable: boolean; reason: PayoutReason } {
  const amount = Number(total) || 0;
  if (amount <= 0) return { payable: false, reason: 'nothing_due' };
  if (amount >= floor) return { payable: true, reason: 'floor_met' };
  if (quarterEnd) return { payable: true, reason: 'quarterly_sweep' };
  return { payable: false, reason: 'below_floor' };
}

export interface PayoutCandidate {
  partnerId: string;
  partnerName: string;
  total: number;
  commissionIds: string[];
  periods: string[];
  hasBanking: boolean;
}

export interface PayoutLine extends PayoutCandidate {
  payable: boolean;
  reason: PayoutReason;
  /** Set when payable but we cannot actually pay — banking details missing. */
  blocked?: string;
}

/** Decide each partner's line for a run. Sorted payable-first, then by value. */
export function buildPayoutRun(
  candidates: PayoutCandidate[],
  opts: { floor?: number; asOf?: Date } = {},
): { floor: number; quarterEnd: boolean; lines: PayoutLine[]; payableTotal: number; heldTotal: number } {
  const floor = opts.floor ?? PAYOUT_FLOOR_DEFAULT;
  const quarterEnd = isQuarterEnd(opts.asOf ?? new Date());

  const lines: PayoutLine[] = candidates.map((c) => {
    const { payable, reason } = payoutDecision(c.total, floor, quarterEnd);
    return {
      ...c,
      payable,
      reason,
      ...(payable && !c.hasBanking ? { blocked: 'No banking details on file' } : {}),
    };
  });

  lines.sort((a, b) => Number(b.payable) - Number(a.payable) || b.total - a.total);

  const sum = (f: (l: PayoutLine) => boolean) =>
    Math.round(lines.filter(f).reduce((t, l) => t + l.total, 0) * 100) / 100;

  return {
    floor,
    quarterEnd,
    lines,
    payableTotal: sum((l) => l.payable && !l.blocked),
    heldTotal: sum((l) => !l.payable || !!l.blocked),
  };
}
