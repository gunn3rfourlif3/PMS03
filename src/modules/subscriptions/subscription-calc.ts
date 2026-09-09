/**
 * Pure subscription pricing. Flat monthly fee per unit-count band:
 *  - Starter:  70–199 units  → R6,014/month
 *  - Growth:   200–499 units → R12,600/month
 *  - Scale:    500+ units    → R22,100/month
 *  - Custom/Enterprise: manual — never auto-computed from unit count.
 * (0 units bills nothing until the agency adds inventory.)
 *
 * Repriced 2026-09-09, repositioning to larger agencies. The bands exist so
 * that the fee at the BOTTOM of each band — where every new customer lands —
 * stays between 5% and 10% of what the agency earns per unit (roughly R850 a
 * month on R10k rent at 8.5%). The old ladder broke that badly: R925 across
 * 1–12 units is R925 per unit for a single-unit agency.
 *
 * Below STARTER_MIN_UNITS there is no published price. Such an agency is priced
 * by negotiation through `priceOverride`, so a small portfolio can still be
 * taken on without publishing a number we would rather not honour. They are
 * still recorded on the `starter` tier: the ladder reports what they are, and
 * the override reports what they pay (see effectivePrice below).
 */
export const TIER_PRICES = {
  starter: Number(process.env.STARTER_PRICE ?? 6014),
  growth: Number(process.env.GROWTH_PRICE ?? 12600),
  scale: Number(process.env.SCALE_PRICE ?? 22100),
};
/** Published entry point. Fewer units than this is a negotiated price, not a cheaper tier. */
export const STARTER_MIN_UNITS = Number(process.env.STARTER_MIN_UNITS ?? 70);
export const STARTER_MAX_UNITS = Number(process.env.STARTER_MAX_UNITS ?? 199);
export const GROWTH_MAX_UNITS = Number(process.env.GROWTH_MAX_UNITS ?? 499);

export type PricedTier = 'starter' | 'growth' | 'scale';

export interface TierResult {
  tier: PricedTier;
  mrr: number;
}

export interface LadderBand {
  tier: PricedTier;
  minUnits: number;
  /** null on the top band — it has no ceiling. */
  maxUnits: number | null;
  price: number;
}

/**
 * The published ladder, as data.
 *
 * Exists so the back-office can describe an agency's plan from the same source
 * that bills them. Before this, `web-admin/app/billing/page.tsx` hard-coded
 * "free Starter plan (up to 10 units) … R250/unit/month" — a pricing model that
 * had already been replaced, so a real customer was being told about a free
 * tier that does not exist. Copy that restates prices in a second place will
 * drift; copy generated from here cannot.
 */
export function ladder(): LadderBand[] {
  return [
    { tier: 'starter', minUnits: STARTER_MIN_UNITS, maxUnits: STARTER_MAX_UNITS, price: TIER_PRICES.starter },
    { tier: 'growth', minUnits: STARTER_MAX_UNITS + 1, maxUnits: GROWTH_MAX_UNITS, price: TIER_PRICES.growth },
    { tier: 'scale', minUnits: GROWTH_MAX_UNITS + 1, maxUnits: null, price: TIER_PRICES.scale },
  ];
}

/** The band an agency moves into next, or null when already on the top band. */
export function nextBand(unitCount: number): LadderBand | null {
  const n = Math.max(0, Math.floor(Number(unitCount) || 0));
  return ladder().find((b) => n < b.minUnits) ?? null;
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
