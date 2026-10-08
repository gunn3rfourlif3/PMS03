import { computeConsumption, deriveCost } from '../src/modules/utilities/utility-calc';

const ok = (r: ReturnType<typeof computeConsumption>) => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`);
  return r;
};

describe('consumption', () => {
  it('is the difference between two readings', () => {
    expect(ok(computeConsumption({ metered: true, reading: 1450, previousReading: 1200 })).consumption).toBe(250);
  });

  // The first reading establishes a baseline. Reporting it as 0 would be
  // indistinguishable from a tenant who used nothing all month.
  it('is null, not zero, on the first reading', () => {
    const r = ok(computeConsumption({ metered: true, reading: 1200, previousReading: null }));
    expect(r.consumption).toBeNull();
    expect(r.baseline).toBe(true);
  });

  it('is zero when the dial has not moved', () => {
    expect(ok(computeConsumption({ metered: true, reading: 1200, previousReading: 1200 })).consumption).toBe(0);
  });

  it('applies the CT ratio', () => {
    expect(ok(computeConsumption({ metered: true, reading: 1450, previousReading: 1200, multiplier: 20 })).consumption).toBe(5000);
  });

  it('rejects a multiplier of zero or less', () => {
    expect(computeConsumption({ metered: true, reading: 10, previousReading: 1, multiplier: 0 }).ok).toBe(false);
  });

  describe('rollover', () => {
    // A 5-digit meter at 99,800 that wraps to 150 used 350, not -99,650.
    it('wraps past the dial ceiling', () => {
      const r = ok(computeConsumption({
        metered: true, reading: 150, previousReading: 99800, dialDigits: 5, rollover: true,
      }));
      expect(r.consumption).toBe(350);
    });

    it('applies the multiplier to the wrapped figure', () => {
      const r = ok(computeConsumption({
        metered: true, reading: 150, previousReading: 99800, dialDigits: 5, rollover: true, multiplier: 2,
      }));
      expect(r.consumption).toBe(700);
    });

    it('refuses without the dial digits, since the wrap cannot be computed', () => {
      const r = computeConsumption({ metered: true, reading: 150, previousReading: 99800, rollover: true });
      expect(r.ok).toBe(false);
    });
  });

  // The decision that matters: a lower reading is a wrap or a typo, and nothing
  // here can tell which. Guessing doubles a bill or hides a leak.
  it('rejects a lower reading rather than guessing at a rollover', () => {
    const r = computeConsumption({ metered: true, reading: 900, previousReading: 1200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('rolled over');
  });

  it('rejects a negative or missing reading on a metered point', () => {
    expect(computeConsumption({ metered: true, reading: -5, previousReading: 1 }).ok).toBe(false);
    expect(computeConsumption({ metered: true, reading: null, previousReading: 1 }).ok).toBe(false);
  });

  describe('unmetered services', () => {
    it('have no consumption', () => {
      const r = ok(computeConsumption({ metered: false }));
      expect(r.consumption).toBeNull();
    });

    it('reject a dial value, because there is no dial', () => {
      expect(computeConsumption({ metered: false, reading: 120 }).ok).toBe(false);
    });
  });
});

describe('cost', () => {
  it('is consumption times the tariff when no cost is supplied', () => {
    expect(deriveCost(250, 2.75, null)).toBe(687.5);
  });

  it('prefers a supplied cost over the computed one', () => {
    expect(deriveCost(250, 2.75, 700)).toBe(700);
  });

  it('is null when there is nothing to compute from', () => {
    expect(deriveCost(null, 2.75, null)).toBeNull();
    expect(deriveCost(250, null, null)).toBeNull();
  });

  // Unmetered: no consumption, no tariff, but the municipality still charged.
  it('is the supplied figure for an unmetered service', () => {
    expect(deriveCost(null, null, 310.5)).toBe(310.5);
  });
});
