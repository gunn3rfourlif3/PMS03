import { commissionAmount, monthsElapsed, withinWindow } from '../src/modules/partners/commission-calc';

describe('partner commission maths', () => {
  it('takes the rate off the MRR', () => {
    expect(commissionAmount(6250, 0.10)).toBe(625);
    expect(commissionAmount(0, 0.10)).toBe(0);
  });

  it('counts whole months from start to period', () => {
    expect(monthsElapsed('2026-06-15T00:00:00Z', '2026-06')).toBe(0);
    expect(monthsElapsed('2026-06-15T00:00:00Z', '2026-08')).toBe(2);
    expect(monthsElapsed('2025-12-01T00:00:00Z', '2026-02')).toBe(2);
  });

  it('respects the commission window (lifetime vs N months)', () => {
    expect(withinWindow('2026-06-01T00:00:00Z', '2026-08', null)).toBe(true);   // lifetime
    expect(withinWindow('2026-06-01T00:00:00Z', '2026-08', 3)).toBe(true);      // month 2 of 3
    expect(withinWindow('2026-06-01T00:00:00Z', '2026-09', 3)).toBe(false);     // month 3 → past window
    expect(withinWindow('2026-06-01T00:00:00Z', '2026-05', null)).toBe(false);  // before start
  });
});
