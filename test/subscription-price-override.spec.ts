import { effectivePrice, overrideActive, tierForUnits } from '../src/modules/subscriptions/subscription-calc';

// docs/LOCARE_COMMISSION_STRUCTURE.md §7.2 — Dantalan signed at R925 with no VAT
// position stated and is grandfathered for their current term. Without an
// override the ladder reprices them the moment anyone opens their subscription
// page, and the next invoice bills the new number.
describe('grandfathered pricing', () => {
  const asOf = new Date('2026-08-24T12:00:00Z');

  it('bills the ladder when there is no override', () => {
    expect(effectivePrice({ mrr: 2660 }, asOf)).toEqual({ amount: 2660, overridden: false });
  });

  it('bills the negotiated price instead of the tier price', () => {
    const dantalan = { tier: 'growth', mrr: 2660, priceOverride: 925, priceOverrideUntil: null };
    expect(effectivePrice(dantalan, asOf)).toEqual({ amount: 925, overridden: true });
  });

  it('leaves the tier and its list price alone', () => {
    // The agency really is on the tier the ladder says — they just pay
    // something else for it. Misreporting the tier to protect a price would
    // corrupt the back-office, the admin list and the commission basis.
    //
    // 60 units sits below the published entry point, so the ladder reports the
    // unpublished Custom tier and its computed per-unit price. An override
    // changes what is BILLED, never what the row says the agency is.
    expect(tierForUnits(60)).toEqual({ tier: 'custom', mrr: 5155 });
    expect(tierForUnits(250)).toEqual({ tier: 'growth', mrr: 12600 });
  });

  it('resumes the ladder once the term ends', () => {
    const sub = { tier: 'growth', mrr: 2660, priceOverride: 925, priceOverrideUntil: '2026-08-31' };
    expect(effectivePrice(sub, new Date('2026-08-31T09:00:00Z')).amount).toBe(925);
    expect(effectivePrice(sub, new Date('2026-09-01T00:00:01Z'))).toEqual({ amount: 2660, overridden: false });
  });

  it('honours the price on the final day of the term', () => {
    // "Until end December" must not reprice someone on 31 December.
    expect(overrideActive(925, '2026-12-31', new Date('2026-12-31T23:00:00Z'))).toBe(true);
    expect(overrideActive(925, '2026-12-31', new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('treats a null term as open-ended', () => {
    expect(overrideActive(925, null, new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });

  it('distinguishes a negotiated zero from no override', () => {
    // 0 is a real negotiated price (a pilot, a written-off month). It must not
    // be read as "fall back to the ladder" — that would bill someone who was
    // promised nothing.
    expect(effectivePrice({ mrr: 2660, priceOverride: 0 }, asOf)).toEqual({ amount: 0, overridden: true });
    expect(effectivePrice({ mrr: 2660, priceOverride: null }, asOf)).toEqual({ amount: 2660, overridden: false });
    expect(effectivePrice({ mrr: 2660, priceOverride: undefined }, asOf)).toEqual({ amount: 2660, overridden: false });
  });

  it('handles numeric columns arriving as strings from pg', () => {
    // Postgres `numeric` comes back as a string through node-postgres.
    expect(effectivePrice({ mrr: '2660', priceOverride: '925' }, asOf)).toEqual({ amount: 925, overridden: true });
  });

  it('ignores an unparseable override rather than billing NaN', () => {
    expect(effectivePrice({ mrr: 2660, priceOverride: 'not a number' as any }, asOf))
      .toEqual({ amount: 2660, overridden: false });
  });

  it('keeps the price when the term date is unreadable', () => {
    // Failing open on the customer's side: a bad date should not trigger a
    // surprise increase on the only paying customer.
    expect(overrideActive(925, 'not-a-date', asOf)).toBe(true);
  });
});

describe('tier ladder still matches the published site', () => {
  it.each([
    [0, 'starter', 0],
    [70, 'starter', 6014],
    [199, 'starter', 6014],
    [200, 'growth', 12600],
    [499, 'growth', 12600],
    [500, 'scale', 22100],
    [5000, 'scale', 22100],
  ])('%i units -> %s', (units, tier, mrr) => {
    expect(tierForUnits(units as number)).toEqual({ tier, mrr });
  });
});
