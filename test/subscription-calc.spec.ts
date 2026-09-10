import { tierForUnits, TIER_PRICES, STARTER_MIN_UNITS, MIN_BILLABLE_UNITS, ladder, nextBand, belowFloor, belowMinimum, billableUnits, customPrice, customUnitRate, effectivePrice } from '../src/modules/subscriptions/subscription-calc';

/**
 * Repriced 2026-09-09 for the move upmarket. The band EDGES are the assertions
 * that matter: the floor of each band is where every new customer lands, and a
 * wrong boundary either bills an agency for a tier they are not on or hands
 * them a cheaper one.
 */
describe('subscription pricing (flat banded tiers)', () => {
  it('bills nothing at zero units', () => {
    expect(tierForUnits(0)).toEqual({ tier: 'starter', mrr: 0 });
  });

  it('Starter (70–199) is a flat R6,014', () => {
    expect(tierForUnits(70)).toEqual({ tier: 'starter', mrr: 6014 });
    expect(tierForUnits(199)).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
  });

  it('Growth (200–499) is a flat R12,600', () => {
    expect(tierForUnits(200)).toEqual({ tier: 'growth', mrr: 12600 });
    expect(tierForUnits(499)).toEqual({ tier: 'growth', mrr: TIER_PRICES.growth });
  });

  it('Scale (500+) is a flat R22,100', () => {
    expect(tierForUnits(500)).toEqual({ tier: 'scale', mrr: 22100 });
    expect(tierForUnits(5000)).toEqual({ tier: 'scale', mrr: TIER_PRICES.scale });
  });

  // Below the published entry point an agency is on Custom — priced per unit at
  // an unpublished rate, not handed a cheaper published band. See the dedicated
  // describe block below for the arithmetic.
  it('routes everything below the entry point to the custom tier', () => {
    expect(STARTER_MIN_UNITS).toBe(70);
    expect(tierForUnits(1).tier).toBe('custom');
    expect(tierForUnits(69).tier).toBe('custom');
    expect(tierForUnits(70)).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
  });

  it('is defensive about junk input', () => {
    expect(tierForUnits(-5)).toEqual({ tier: 'starter', mrr: 0 });
    expect(tierForUnits(199.9)).toEqual({ tier: 'starter', mrr: 6014 }); // floors to 199
  });
});

/**
 * The back-office describes an agency's plan from this, rather than restating
 * prices in the UI. It did restate them once, and told a live customer they
 * were on a free tier with per-unit pricing that had already been replaced.
 */
describe('ladder as data', () => {
  it('describes contiguous bands with no gap or overlap', () => {
    const bands = ladder();
    expect(bands.map((b) => b.tier)).toEqual(['starter', 'growth', 'scale']);
    expect(bands[0]).toMatchObject({ minUnits: 70, maxUnits: 199, price: 6014 });
    expect(bands[1]).toMatchObject({ minUnits: 200, maxUnits: 499, price: 12600 });
    expect(bands[2]).toMatchObject({ minUnits: 500, maxUnits: null, price: 22100 });
    // Each band starts exactly where the previous one ends.
    expect(bands[1].minUnits).toBe((bands[0].maxUnits as number) + 1);
    expect(bands[2].minUnits).toBe((bands[1].maxUnits as number) + 1);
  });

  it('agrees with the biller at every boundary', () => {
    for (const b of ladder()) {
      expect(tierForUnits(b.minUnits)).toEqual({ tier: b.tier, mrr: b.price });
      if (b.maxUnits !== null) expect(tierForUnits(b.maxUnits)).toEqual({ tier: b.tier, mrr: b.price });
    }
  });

  it('names the band an agency moves into next', () => {
    expect(nextBand(40)?.tier).toBe('starter');   // not yet at the entry point
    expect(nextBand(150)?.tier).toBe('growth');
    expect(nextBand(300)?.tier).toBe('scale');
    expect(nextBand(900)).toBeNull();             // already on the top band
  });
});

/**
 * The floor guard. `tierForUnits` prices an 11-unit agency at the full Starter
 * fee, because it really is on Starter — it is simply below the point where
 * that fee is defensible. `belowFloor` is what billing and the runbook use to
 * insist a human names a price instead.
 *
 * The live case this exists for: a founding agency on a legacy R925, whose
 * `mrr` is rewritten to the ladder's R6,014 the first time anyone opens the
 * billing page. Without the guard the next run invoices the new figure.
 */
describe('below the published entry point', () => {
  it('is true from one unit up to the entry point, exclusive', () => {
    expect(belowFloor(1)).toBe(true);
    expect(belowFloor(11)).toBe(true);
    expect(belowFloor(STARTER_MIN_UNITS - 1)).toBe(true);
  });

  it('is false at and above the entry point', () => {
    expect(belowFloor(STARTER_MIN_UNITS)).toBe(false);
    expect(belowFloor(200)).toBe(false);
    expect(belowFloor(10_000)).toBe(false);
  });

  it('does not treat an empty portfolio as below the floor', () => {
    // No inventory loaded yet is mid-onboarding, not a pricing decision.
    expect(belowFloor(0)).toBe(false);
    expect(belowFloor(null)).toBe(false);
    expect(belowFloor(undefined)).toBe(false);
    expect(belowFloor('')).toBe(false);
  });

  it('tolerates the strings Postgres numerics arrive as', () => {
    expect(belowFloor('11')).toBe(true);
    expect(belowFloor('70')).toBe(false);
    expect(belowFloor('nonsense')).toBe(false);
  });

  it('is the condition billing pairs with an inactive override', () => {
    // Together these two are the guard in SubscriptionBillingService.generate:
    // charged for units they do not have AND nobody has agreed it => no invoice.
    const dantalan = { tier: 'custom', mrr: customPrice(11), priceOverride: null, priceOverrideUntil: null };
    expect(belowMinimum(11) && !effectivePrice(dantalan).overridden).toBe(true);

    const held = { ...dantalan, priceOverride: 925, priceOverrideUntil: '2027-03-31' };
    expect(belowMinimum(11) && !effectivePrice(held, new Date('2026-10-01')).overridden).toBe(false);
    expect(effectivePrice(held, new Date('2026-10-01')).amount).toBe(925);

    // Once the agreed term lapses the guard bites again rather than silently
    // reverting the customer to list price.
    expect(effectivePrice(held, new Date('2027-04-01')).overridden).toBe(false);
    expect(belowMinimum(11) && !effectivePrice(held, new Date('2027-04-01')).overridden).toBe(true);
  });
});

/**
 * The Custom tier: unpublished, per-unit, below the entry point.
 *
 * Two properties carry the whole design. The rate is DERIVED from Starter, so
 * the boundary cannot drift apart in a future reprice. And the minimum means a
 * very small agency is billed for units it does not have — defensible as policy,
 * but only once a human has agreed it, which is what `belowMinimum` gates.
 */
describe('custom tier (below the published entry point)', () => {
  it('derives the rate from Starter, not from a separate number', () => {
    expect(customUnitRate()).toBeCloseTo(TIER_PRICES.starter / STARTER_MIN_UNITS, 2);
    expect(customUnitRate()).toBe(85.91);
  });

  it('prices per unit and reports the custom tier', () => {
    expect(tierForUnits(30)).toEqual({ tier: 'custom', mrr: 2577 });
    expect(tierForUnits(42)).toEqual({ tier: 'custom', mrr: 3608 });
    expect(tierForUnits(69)).toEqual({ tier: 'custom', mrr: 5928 });
  });

  it('never charges more than the band above it — the boundary is continuous', () => {
    const justBelow = tierForUnits(STARTER_MIN_UNITS - 1);
    const atEntry = tierForUnits(STARTER_MIN_UNITS);
    expect(justBelow.mrr).toBeLessThan(atEntry.mrr);
    expect(atEntry).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
    // The gap is a rounding artefact, not a step: pennies, not a cliff.
    expect(atEntry.mrr - justBelow.mrr).toBeLessThan(customUnitRate() + 1);
  });

  it('bills the minimum for a portfolio smaller than the minimum', () => {
    expect(billableUnits(5)).toBe(MIN_BILLABLE_UNITS);
    expect(billableUnits(29)).toBe(MIN_BILLABLE_UNITS);
    expect(billableUnits(30)).toBe(30);
    expect(billableUnits(45)).toBe(45);
    expect(customPrice(5)).toBe(customPrice(MIN_BILLABLE_UNITS));
  });

  it('bills nothing at zero units, and does not call that Custom', () => {
    // An agency mid-migration with nothing loaded must never be invoiced the
    // minimum. This is the way this feature would most plausibly go wrong, and
    // it would go wrong on a brand-new customer.
    expect(billableUnits(0)).toBe(0);
    expect(customPrice(0)).toBe(0);
    expect(tierForUnits(0)).toEqual({ tier: 'starter', mrr: 0 });
  });

  it('gates the minimum behind a human decision', () => {
    expect(belowMinimum(0)).toBe(false);   // nothing loaded yet
    expect(belowMinimum(11)).toBe(true);   // charged for 30, has 11
    expect(belowMinimum(29)).toBe(true);
    expect(belowMinimum(30)).toBe(false);  // charged for what it has
    expect(belowMinimum(80)).toBe(false);
  });

  it('separates "no published price" from "below the minimum"', () => {
    // 40 units has no PUBLISHED price but a perfectly good computed one;
    // 11 units has both, and only the second needs sign-off.
    expect(belowFloor(40)).toBe(true);
    expect(belowMinimum(40)).toBe(false);
    expect(belowFloor(11)).toBe(true);
    expect(belowMinimum(11)).toBe(true);
  });

  it('holds a constant share of the agency income below the entry point', () => {
    // The rule the ladder exists to satisfy: the fee stays near 10% of what the
    // agency earns (R850/unit on R10k rent at 8.5%) at every size, instead of
    // ballooning as the portfolio shrinks.
    for (const units of [30, 40, 50, 69]) {
      const share = tierForUnits(units).mrr / (units * 850);
      expect(share).toBeGreaterThan(0.09);
      expect(share).toBeLessThan(0.11);
    }
  });
});
