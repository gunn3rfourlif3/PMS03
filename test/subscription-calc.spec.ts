import { tierForUnits, TIER_PRICES, STARTER_MIN_UNITS } from '../src/modules/subscriptions/subscription-calc';

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

  // Below the published entry point there is no cheaper tier. Such an agency is
  // recorded on Starter at the Starter price, and whatever was negotiated is
  // applied as a priceOverride — so the ladder never quietly under-bills.
  it('does not invent a cheaper tier below the published entry point', () => {
    expect(STARTER_MIN_UNITS).toBe(70);
    expect(tierForUnits(1)).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
    expect(tierForUnits(69)).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
  });

  it('is defensive about junk input', () => {
    expect(tierForUnits(-5)).toEqual({ tier: 'starter', mrr: 0 });
    expect(tierForUnits(199.9)).toEqual({ tier: 'starter', mrr: 6014 }); // floors to 199
  });
});
