import { screen } from '../src/modules/listings/screening';
import { canTransition } from '../src/modules/listings/application-transitions';

describe('applicant screening', () => {
  it('approves strong income + credit', () => {
    const r = screen({ monthlyIncome: 30000, creditScore: 700, rent: 8000 });
    expect(r.recommendation).toBe('approve');
    expect(r.incomeToRent).toBeCloseTo(3.75, 2);
  });
  it('declines weak income', () => {
    expect(screen({ monthlyIncome: 15000, creditScore: 700, rent: 8000 }).recommendation).toBe('decline');
  });
  it('declines poor credit', () => {
    expect(screen({ monthlyIncome: 30000, creditScore: 500, rent: 8000 }).recommendation).toBe('decline');
  });
  it('reviews the middle ground', () => {
    expect(screen({ monthlyIncome: 30000, creditScore: 600, rent: 8000 }).recommendation).toBe('review');
  });
});

describe('application transitions', () => {
  it('allows the happy path', () => {
    expect(canTransition('submitted', 'screening')).toBe(true);
    expect(canTransition('screening', 'approved')).toBe(true);
  });
  it('blocks illegal jumps and terminal exits', () => {
    expect(canTransition('submitted', 'approved')).toBe(false);
    expect(canTransition('approved', 'rejected')).toBe(false);
    expect(canTransition('withdrawn', 'screening')).toBe(false);
  });
});
