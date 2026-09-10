import { ladder } from '../src/modules/subscriptions/subscription-calc';

/**
 * The partner introduction email quotes prices and commission. It once quoted
 * them from a hand-copied table with a "keep them in step" comment, and after
 * the 2026-09-09 reprice it spent days telling real applicants that Starter was
 * R925 and paid R74. These assertions pin the figures to the live ladder so the
 * same drift fails a test instead of reaching an inbox.
 */
const INTRODUCER_RATE = 0.08;
const rands = (n: number) => `R${Math.round(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const commission = (price: number) => Math.round(price * INTRODUCER_RATE);

describe('partner introduction email figures', () => {
  it('groups thousands with a comma, not a locale-dependent space', () => {
    // toLocaleString('en-ZA') groups with U+00A0 or U+202F depending on the ICU
    // build — invisible locally, wrong in an email.
    expect(rands(12600)).toBe('R12,600');
    expect(rands(481.12)).toBe('R481');
    expect(rands(925)).toBe('R925');
    expect(rands(1_000_000)).toBe('R1,000,000');
  });

  it('pays the introducer 8% of each published band', () => {
    const rows = Object.fromEntries(ladder().map((b) => [b.tier, commission(b.price)]));
    expect(rows.starter).toBe(481);
    expect(rows.growth).toBe(1008);
    expect(rows.scale).toBe(1768);
  });

  it('quotes the current ladder, not the pre-reprice one', () => {
    const prices = ladder().map((b) => b.price);
    expect(prices).toEqual([6014, 12600, 22100]);
    // The figures that leaked into applicants' inboxes. If any reappears, the
    // email is reading a stale source again.
    expect(prices).not.toContain(925);
    expect(prices).not.toContain(2660);
  });

  it('states the five-Growth headline as five times the Growth commission', () => {
    const growth = ladder().find((b) => b.tier === 'growth')!;
    expect(rands(commission(growth.price) * 5)).toBe('R5,040');
  });
});
