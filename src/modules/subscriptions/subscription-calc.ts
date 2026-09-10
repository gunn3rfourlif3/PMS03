/**
 * Pure subscription pricing. Flat monthly fee per unit-count band:
 *  - Custom:   1–69 units    → per unit, UNPUBLISHED (see below)
 *  - Starter:  70–199 units  → R6,014/month
 *  - Growth:   200–499 units → R12,600/month
 *  - Scale:    500+ units    → R22,100/month
 *  - Enterprise: manual — never auto-computed from unit count.
 * (0 units bills nothing until the agency adds inventory.)
 *
 * Repriced 2026-09-09, repositioning to larger agencies. The bands exist so
 * that the fee at the BOTTOM of each band — where every new customer lands —
 * stays between 5% and 10% of what the agency earns per unit (roughly R850 a
 * month on R10k rent at 8.5%). The old ladder broke that badly: R925 across
 * 1–12 units is R925 per unit for a single-unit agency.
 *
 * Below STARTER_MIN_UNITS the price is PER UNIT and is not published anywhere:
 * not on the site, only in the sales conversation and the partner pack. The
 * rate is Starter's fee divided by its entry point, so the two meet exactly at
 * the boundary — 69 units costs slightly less than 70, never more, and there is
 * no cliff for a growing agency to fall off.
 *
 * A minimum billable unit count applies, because cost to serve scales with
 * AGENCIES, not units: onboarding and support cost about the same for twelve
 * units as for a hundred and ninety. An agency below the minimum is billed the
 * minimum. Anything softer than that is a `priceOverride`, decided by a human.
 */
export const TIER_PRICES = {
  starter: Number(process.env.STARTER_PRICE ?? 6014),
  growth: Number(process.env.GROWTH_PRICE ?? 12600),
  scale: Number(process.env.SCALE_PRICE ?? 22100),
};
/** Published entry point. Fewer units than this is the unpublished Custom tier. */
export const STARTER_MIN_UNITS = Number(process.env.STARTER_MIN_UNITS ?? 70);
/**
 * Smallest portfolio we will bill for. An agency with fewer units pays as if it
 * had this many; below it, onboarding never pays back inside a year.
 */
export const MIN_BILLABLE_UNITS = Number(process.env.MIN_BILLABLE_UNITS ?? 30);
export const STARTER_MAX_UNITS = Number(process.env.STARTER_MAX_UNITS ?? 199);
export const GROWTH_MAX_UNITS = Number(process.env.GROWTH_MAX_UNITS ?? 499);

export type PricedTier = 'custom' | 'starter' | 'growth' | 'scale';

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
  // An agency with nothing loaded is mid-onboarding. It is not on Custom — we
  // do not know yet how big it is — and it bills nothing either way.
  if (n === 0) return { tier: 'starter', mrr: 0 };
  if (n < STARTER_MIN_UNITS) return { tier: 'custom', mrr: customPrice(n) };
  if (n <= STARTER_MAX_UNITS) return { tier: 'starter', mrr: TIER_PRICES.starter };
  if (n <= GROWTH_MAX_UNITS) return { tier: 'growth', mrr: TIER_PRICES.growth };
  return { tier: 'scale', mrr: TIER_PRICES.scale };
}

/**
 * The per-unit rate for the Custom tier.
 *
 * Derived from the published ladder rather than set independently: Starter's
 * fee divided by Starter's entry point. That is what makes the boundary
 * continuous — 69 units bills R5,928 and 70 bills R6,014 — and it means a
 * future reprice of Starter carries the small-agency rate with it instead of
 * silently opening a gap at 70 units.
 *
 * Rounded to the cent so the figure an agency multiplies out by hand matches
 * the one on the invoice.
 */
export function customUnitRate(): number {
  const override = Number(process.env.CUSTOM_UNIT_RATE);
  if (Number.isFinite(override) && override > 0) return Math.round(override * 100) / 100;
  return Math.round((TIER_PRICES.starter / STARTER_MIN_UNITS) * 100) / 100;
}

/** Units actually charged for: never fewer than the minimum. */
export function billableUnits(unitCount: number | string | null | undefined): number {
  const n = Math.max(0, Math.floor(Number(unitCount) || 0));
  return n === 0 ? 0 : Math.max(n, MIN_BILLABLE_UNITS);
}

/** Custom-tier monthly fee, rounded to the rand. Zero units bills zero. */
export function customPrice(unitCount: number | string | null | undefined): number {
  return Math.round(billableUnits(unitCount) * customUnitRate());
}

/**
 * Whether an agency is being charged for units it does not have.
 *
 * This is the case a human must sign off. The minimum is defensible as policy —
 * cost to serve is per agency, not per unit — but an eleven-unit agency billed
 * for thirty will ask, and someone should have decided to charge it before the
 * invoice goes out rather than after. Billing refuses until they do.
 */
export function belowMinimum(unitCount: number | string | null | undefined): boolean {
  const n = Math.floor(Number(unitCount) || 0);
  return n > 0 && n < MIN_BILLABLE_UNITS;
}

/**
 * Whether a portfolio is too small to have a published price.
 *
 * A flat published fee cannot stretch this far down: R6,014 against eleven
 * units is R547 a unit, most of what the agency earns on each one. Per-unit
 * pricing holds the same 10% of the agency's income at every size below the
 * entry point instead.
 *
 * So this is what selects the Custom tier: below the entry point an agency is
 * priced per unit at an unpublished rate, not given a cheaper published band.
 * The separate `belowMinimum` is the "someone must decide" rule.
 *
 * Zero units is not below the floor: an agency with no inventory loaded yet is
 * mid-onboarding, bills nothing, and needs no decision.
 */
export function belowFloor(unitCount: number | string | null | undefined): boolean {
  const n = Math.floor(Number(unitCount) || 0);
  return n > 0 && n < STARTER_MIN_UNITS;
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
