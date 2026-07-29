/**
 * Pure subscription pricing. Locked decisions:
 *  - Starter: ≤ 10 units, free (MRR 0).
 *  - Growth:  > 10 units, ALL units billed at R250/unit/month.
 *  - Enterprise: manual — never auto-computed from unit count.
 */
export const GROWTH_PRICE_PER_UNIT = Number(process.env.GROWTH_PRICE_PER_UNIT ?? 250);
export const FREE_UNIT_THRESHOLD = Number(process.env.FREE_UNIT_THRESHOLD ?? 10);

export interface TierResult {
  tier: 'starter' | 'growth';
  mrr: number;
}

/** Tier + monthly recurring revenue for a given unit count (non-enterprise). */
export function tierForUnits(unitCount: number): TierResult {
  const n = Math.max(0, Math.floor(Number(unitCount) || 0));
  if (n > FREE_UNIT_THRESHOLD) return { tier: 'growth', mrr: n * GROWTH_PRICE_PER_UNIT };
  return { tier: 'starter', mrr: 0 };
}
