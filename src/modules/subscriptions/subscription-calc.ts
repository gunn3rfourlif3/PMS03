/**
 * Pure subscription pricing. Flat monthly fee per unit-count band:
 *  - Starter:  1–12 units    → R925/month
 *  - Growth:   13–364 units  → R2,660/month
 *  - Scale:    365+ units    → R6,014/month
 *  - Custom/Enterprise: manual — never auto-computed from unit count.
 * (0 units bills nothing until the agency adds inventory.)
 */
export const TIER_PRICES = {
  starter: Number(process.env.STARTER_PRICE ?? 925),
  growth: Number(process.env.GROWTH_PRICE ?? 2660),
  scale: Number(process.env.SCALE_PRICE ?? 6014),
};
export const STARTER_MAX_UNITS = Number(process.env.STARTER_MAX_UNITS ?? 12);
export const GROWTH_MAX_UNITS = Number(process.env.GROWTH_MAX_UNITS ?? 364);

export type PricedTier = 'starter' | 'growth' | 'scale';

export interface TierResult {
  tier: PricedTier;
  mrr: number;
}

/** Tier + monthly recurring revenue for a given unit count (non-enterprise). */
export function tierForUnits(unitCount: number): TierResult {
  const n = Math.max(0, Math.floor(Number(unitCount) || 0));
  if (n === 0) return { tier: 'starter', mrr: 0 };
  if (n <= STARTER_MAX_UNITS) return { tier: 'starter', mrr: TIER_PRICES.starter };
  if (n <= GROWTH_MAX_UNITS) return { tier: 'growth', mrr: TIER_PRICES.growth };
  return { tier: 'scale', mrr: TIER_PRICES.scale };
}
