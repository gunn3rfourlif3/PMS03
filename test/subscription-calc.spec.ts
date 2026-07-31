import { tierForUnits, TIER_PRICES } from '../src/modules/subscriptions/subscription-calc';

describe('subscription pricing (flat banded tiers)', () => {
  it('bills nothing at zero units', () => {
    expect(tierForUnits(0)).toEqual({ tier: 'starter', mrr: 0 });
  });

  it('Starter (1–12) is a flat R925', () => {
    expect(tierForUnits(1)).toEqual({ tier: 'starter', mrr: TIER_PRICES.starter });
    expect(tierForUnits(12)).toEqual({ tier: 'starter', mrr: 925 });
  });

  it('Growth (13–364) is a flat R2,660', () => {
    expect(tierForUnits(13)).toEqual({ tier: 'growth', mrr: 2660 });
    expect(tierForUnits(364)).toEqual({ tier: 'growth', mrr: TIER_PRICES.growth });
  });

  it('Scale (365+) is a flat R6,014', () => {
    expect(tierForUnits(365)).toEqual({ tier: 'scale', mrr: 6014 });
    expect(tierForUnits(5000)).toEqual({ tier: 'scale', mrr: TIER_PRICES.scale });
  });

  it('is defensive about junk input', () => {
    expect(tierForUnits(-5)).toEqual({ tier: 'starter', mrr: 0 });
    expect(tierForUnits(12.9)).toEqual({ tier: 'starter', mrr: 925 }); // floors to 12
  });
});
