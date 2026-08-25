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

/**
 * Whether a negotiated price still applies on a given date.
 *
 * A null `until` is open-ended. The date is the LAST day the override applies,
 * so a term ending 2026-12-31 is still honoured on that day — a customer told
 * "until end December" does not expect to be repriced on the 31st.
 */
export function overrideActive(
  priceOverride: number | string | null | undefined,
  until: Date | string | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (priceOverride === null || priceOverride === undefined || priceOverride === '') return false;
  if (!Number.isFinite(Number(priceOverride))) return false;
  if (!until) return true;
  const end = typeof until === 'string' ? new Date(`${until.slice(0, 10)}T23:59:59.999Z`) : new Date(until);
  if (Number.isNaN(end.getTime())) return true; // unparseable date: honour the price, don't silently reprice
  return asOf.getTime() <= end.getTime();
}

/**
 * The price to bill: a live negotiated price, else the ladder.
 *
 * Tier is always the ladder's answer even when the price is overridden — the
 * agency really is on Growth, they are simply paying a different amount for it.
 * Reporting the tier honestly keeps the back-office, the admin list and the
 * commission basis correct.
 */
export function effectivePrice(
  sub: { tier?: string; mrr: number | string; priceOverride?: number | string | null; priceOverrideUntil?: Date | string | null },
  asOf: Date = new Date(),
): { amount: number; overridden: boolean } {
  if (overrideActive(sub.priceOverride, sub.priceOverrideUntil, asOf)) {
    return { amount: Number(sub.priceOverride), overridden: true };
  }
  return { amount: Number(sub.mrr) || 0, overridden: false };
}
