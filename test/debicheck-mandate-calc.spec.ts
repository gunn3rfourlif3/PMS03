import {
  mandateCeiling, breachesCeiling, canTransition, isCollectable, collectionDay,
  DEFAULT_ESCALATION_PCT, CEILING_BUFFER_PCT, MandateState,
} from '../src/modules/debicheck/mandate-calc';

describe('mandate ceiling (§5, §11.8)', () => {
  // The case that killed the flat-15% rule: 3 years at 8% ends 26% up.
  it('covers a three-year lease that a flat 15% headroom would breach', () => {
    const r = mandateCeiling({ rentAmount: 10000, termMonths: 36, escalationPct: 8 });
    expect(r.escalations).toBe(2);
    expect(r.finalRent).toBeCloseTo(11664, 0);
    expect(r.ceiling).toBe(12831);
    expect(r.ceiling).toBeGreaterThan(10000 * 1.15); // the old rule would have failed here
  });

  it('a 12-month lease escalates zero times within its term', () => {
    const r = mandateCeiling({ rentAmount: 10000, termMonths: 12, escalationPct: 8 });
    expect(r.escalations).toBe(0);
    expect(r.finalRent).toBe(10000);
    expect(r.ceiling).toBe(11000); // rent + buffer only
  });

  it('a 24-month lease escalates once', () => {
    expect(mandateCeiling({ rentAmount: 10000, termMonths: 24, escalationPct: 8 }).escalations).toBe(1);
  });

  it('rounds the ceiling UP — rounding down re-creates the breach', () => {
    const r = mandateCeiling({ rentAmount: 9999, termMonths: 36, escalationPct: 7.5 });
    expect(Number.isInteger(r.ceiling)).toBe(true);
    expect(r.ceiling).toBeGreaterThanOrEqual(r.finalRent);
  });

  it('flags when the escalation rate was assumed rather than stated', () => {
    const stated = mandateCeiling({ rentAmount: 10000, termMonths: 36, escalationPct: 6 });
    const assumed = mandateCeiling({ rentAmount: 10000, termMonths: 36 });
    expect(stated.assumedEscalation).toBe(false);
    expect(assumed.assumedEscalation).toBe(true);
    expect(assumed.escalationPct).toBe(DEFAULT_ESCALATION_PCT);
  });

  it('handles a zero-escalation lease without inflating the ceiling', () => {
    const r = mandateCeiling({ rentAmount: 10000, termMonths: 36, escalationPct: 0 });
    expect(r.finalRent).toBe(10000);
    expect(r.ceiling).toBe(10000 * (1 + CEILING_BUFFER_PCT / 100));
  });

  it('survives junk input rather than producing a nonsense ceiling', () => {
    expect(mandateCeiling({ rentAmount: 0, termMonths: 0 }).ceiling).toBe(0);
    expect(mandateCeiling({ rentAmount: -5, termMonths: -12 }).ceiling).toBe(0);
    expect(mandateCeiling({ rentAmount: 10000, termMonths: 36, escalationPct: -3 }).escalationPct).toBe(0);
  });

  // Keeping the maximum sane matters: the tenant sees it when authenticating.
  it('does not produce an alarming multiple on a normal lease', () => {
    const r = mandateCeiling({ rentAmount: 12000, termMonths: 36, escalationPct: 8 });
    expect(r.ceiling / 12000).toBeLessThan(1.5);
  });
});

describe('breachesCeiling', () => {
  it('is exclusive at the boundary — exactly the ceiling is collectable', () => {
    expect(breachesCeiling(12831, 12831)).toBe(false);
    expect(breachesCeiling(12831.01, 12831)).toBe(true);
    expect(breachesCeiling(1, 12831)).toBe(false);
  });
});

describe('mandate state machine (§4)', () => {
  it('follows the documented happy path', () => {
    expect(canTransition('drafted', 'requested')).toBe(true);
    expect(canTransition('requested', 'active')).toBe(true);
    expect(canTransition('active', 'amending')).toBe(true);
    expect(canTransition('amending', 'active')).toBe(true);
  });

  it('cannot skip authentication', () => {
    expect(canTransition('drafted', 'active')).toBe(false);
  });

  it.each<MandateState>(['cancelled', 'rejected', 'expired'])('%s is terminal', (s) => {
    expect(canTransition(s, 'active')).toBe(false);
    expect(canTransition(s, 'requested')).toBe(false);
  });

  // Collections continue at the old ceiling while an amendment is out (§4),
  // otherwise an escalation would stop rent collection entirely.
  it('allows collection while amending, not before authentication', () => {
    expect(isCollectable('active')).toBe(true);
    expect(isCollectable('amending')).toBe(true);
    expect(isCollectable('requested')).toBe(false);
    expect(isCollectable('drafted')).toBe(false);
    expect(isCollectable('cancelled')).toBe(false);
  });
});

describe('collection day (§11.7)', () => {
  it('falls back to the lease rent due day', () => {
    expect(collectionDay(undefined, 25)).toBe(25);
    expect(collectionDay(null, 1)).toBe(1);
  });

  it('prefers an explicit per-lease override', () => {
    expect(collectionDay(25, 1)).toBe(25);
  });

  it('clamps out-of-range values instead of sending a rejected mandate', () => {
    expect(collectionDay(0)).toBe(1);
    expect(collectionDay(45)).toBe(31);
    expect(collectionDay(NaN)).toBe(1);
    expect(collectionDay(15.7)).toBe(15);
  });
});
