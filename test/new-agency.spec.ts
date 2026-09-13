import { planNewAgency, slugify, priceAtTier } from '../src/modules/agencies/new-agency';
import { MIN_BILLABLE_UNITS, TIER_PRICES, customPrice } from '../src/modules/subscriptions/subscription-calc';

const TODAY = new Date('2026-09-13T10:00:00Z');
const base = {
  agencyName: 'Northcliff Letting',
  ownerName: 'Thandi Mokoena',
  ownerEmail: 'thandi@northclifflet.co.za',
  unitCount: 48,
};
const plan = (over: any = {}) => {
  const r = planNewAgency({ ...base, ...over }, TODAY);
  if (!r.ok) throw new Error(r.error);
  return r.plan;
};
const fail = (over: any = {}) => {
  const r = planNewAgency({ ...base, ...over }, TODAY);
  if (r.ok) throw new Error(`expected failure, got ${JSON.stringify(r.plan)}`);
  return r;
};

describe('slugify', () => {
  it('builds a DNS label from an agency name', () => {
    expect(slugify('Northcliff Letting')).toBe('northcliff-letting');
    expect(slugify('  Sea  Point   Rentals  ')).toBe('sea-point-rentals');
    expect(slugify('Smith & Sons (Pty) Ltd')).toBe('smith-and-sons-pty-ltd');
  });

  it('survives accents, punctuation and case', () => {
    expect(slugify('Beziers Property')).toBe('beziers-property');
    expect(slugify('ACME!!!')).toBe('acme');
  });

  it('never leaves a leading or trailing hyphen, even after truncation', () => {
    const s = slugify(`${'a'.repeat(62)} bcd`);
    expect(s.length).toBeLessThanOrEqual(63);
    expect(s.startsWith('-')).toBe(false);
    expect(s.endsWith('-')).toBe(false);
  });

  it('is empty when there is nothing to build from', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('creating a direct agency', () => {
  it('derives the tier and price from the portfolio size', () => {
    // 48 units is below the 70-unit starter floor, so Custom, priced per unit.
    expect(plan({ unitCount: 48 })).toMatchObject({
      tier: 'custom', mrr: customPrice(48), tierOverridden: false,
    });
    expect(plan({ unitCount: 120 })).toMatchObject({ tier: 'starter', mrr: TIER_PRICES.starter });
    expect(plan({ unitCount: 300 })).toMatchObject({ tier: 'growth', mrr: TIER_PRICES.growth });
    expect(plan({ unitCount: 900 })).toMatchObject({ tier: 'scale', mrr: TIER_PRICES.scale });
  });

  it('slugs the name when no slug is given, and prefers one that is', () => {
    expect(plan().slug).toBe('northcliff-letting');
    expect(plan({ slug: 'NorthCliff' }).slug).toBe('northcliff');
  });

  it('refuses a slug that collides with the platform own hosts', () => {
    for (const s of ['app', 'api', 'www', 'tenant', 'landlord', 'rentals', 'admin']) {
      expect(fail({ slug: s }).error).toMatch(/reserved/);
    }
  });

  it('requires a real owner email, because it is how they sign in', () => {
    expect(fail({ ownerEmail: '' }).field).toBe('ownerEmail');
    expect(fail({ ownerEmail: 'thandi' }).field).toBe('ownerEmail');
    expect(fail({ ownerEmail: 'thandi@localhost' }).field).toBe('ownerEmail');
    expect(plan({ ownerEmail: '  Thandi@Northclifflet.CO.ZA ' }).ownerEmail)
      .toBe('thandi@northclifflet.co.za');
  });

  it('defaults a missing owner name rather than refusing', () => {
    expect(plan({ ownerName: '' }).ownerName).toBe('Owner');
  });

  it('refuses a zero or nonsense unit count', () => {
    // Zero prices at zero - an agency created that way bills nothing, silently.
    expect(fail({ unitCount: 0 }).field).toBe('unitCount');
    expect(fail({ unitCount: '' }).field).toBe('unitCount');
    expect(fail({ unitCount: -5 }).field).toBe('unitCount');
    expect(fail({ unitCount: 250000 }).field).toBe('unitCount');
  });
});

describe('the below-minimum rule', () => {
  const tiny = { unitCount: MIN_BILLABLE_UNITS - 1 };

  it('refuses a below-floor portfolio with no agreed price', () => {
    const r = fail(tiny);
    expect(r.field).toBe('priceOverride');
    expect(r.error).toMatch(new RegExp(`${MIN_BILLABLE_UNITS}-unit minimum`));
  });

  it('still refuses when the price is given but the reason is not', () => {
    expect(fail({ ...tiny, priceOverride: 1500 }).field).toBe('priceOverrideReason');
  });

  it('still refuses when there is no end date', () => {
    // An open-ended discount is how a floor stops being a floor.
    expect(fail({ ...tiny, priceOverride: 1500, priceOverrideReason: 'Founding customer' }).field)
      .toBe('priceOverrideUntil');
  });

  it('accepts a price, a reason and a date together', () => {
    const p = plan({
      ...tiny,
      priceOverride: 1500,
      priceOverrideReason: 'Founding customer, reviewed at renewal',
      priceOverrideUntil: '2027-09-13',
    });
    expect(p.priceOverride).toBe(1500);
    expect(p.priceOverrideUntil).toBe('2027-09-13');
    // The tier and MRR still say what the portfolio is worth at list price;
    // the override is what gets billed, and the gap is the discount.
    expect(p.tier).toBe('custom');
    expect(p.mrr).toBe(customPrice(tiny.unitCount));
  });

  it('refuses an end date in the past', () => {
    expect(fail({
      ...tiny, priceOverride: 1500, priceOverrideReason: 'x', priceOverrideUntil: '2020-01-01',
    }).field).toBe('priceOverrideUntil');
  });

  it('leaves an at-or-above-floor agency alone', () => {
    expect(plan({ unitCount: MIN_BILLABLE_UNITS }).priceOverride).toBeNull();
  });

  it('asks for a reason for ANY negotiated price, not only below-floor ones', () => {
    expect(fail({ unitCount: 300, priceOverride: 2000 }).field).toBe('priceOverrideReason');
  });
});

describe('overriding the derived tier', () => {
  it('records that it was overridden, and prices at the tier stored', () => {
    const p = plan({ unitCount: 48, tier: 'starter' });
    expect(p).toMatchObject({ tier: 'starter', tierOverridden: true, mrr: TIER_PRICES.starter });
  });

  it('is not an override when it agrees with the units', () => {
    expect(plan({ unitCount: 120, tier: 'starter' }).tierOverridden).toBe(false);
  });

  it('refuses a tier that does not exist', () => {
    expect(fail({ tier: 'enterprise' }).field).toBe('tier');
    expect(fail({ tier: 'free' }).field).toBe('tier');
  });

  it('prices custom per unit and the flat bands flat', () => {
    expect(priceAtTier('custom', 40)).toBe(customPrice(40));
    expect(priceAtTier('growth', 40)).toBe(TIER_PRICES.growth);
  });
});
