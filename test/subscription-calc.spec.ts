import { tierForUnits, GROWTH_PRICE_PER_UNIT } from '../src/modules/subscriptions/subscription-calc';

describe('subscription pricing', () => {
  it('is free on Starter at or below the 10-unit threshold', () => {
    expect(tierForUnits(0)).toEqual({ tier: 'starter', mrr: 0 });
    expect(tierForUnits(10)).toEqual({ tier: 'starter', mrr: 0 });
  });

  it('moves to Growth above 10 units and bills ALL units at R250', () => {
    expect(tierForUnits(11)).toEqual({ tier: 'growth', mrr: 11 * GROWTH_PRICE_PER_UNIT });
    expect(tierForUnits(40)).toEqual({ tier: 'growth', mrr: 40 * 250 });
  });

  it('is defensive about junk input', () => {
    expect(tierForUnits(-5)).toEqual({ tier: 'starter', mrr: 0 });
    expect(tierForUnits(12.9)).toEqual({ tier: 'growth', mrr: 12 * 250 });
  });
});
