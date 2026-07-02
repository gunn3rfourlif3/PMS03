import { computeDepositReturn } from '../src/modules/billing/deposit-calc';

describe('deposit return (ZA RHA)', () => {
  it('returns principal + interest in full when no deductions', () => {
    expect(computeDepositReturn(10000, 250, [])).toEqual({
      refund: 10250, withheld: 0, status: 'returned',
    });
  });
  it('partially returns after lawful deductions', () => {
    expect(computeDepositReturn(10000, 0, [1500, 500])).toEqual({
      refund: 8000, withheld: 2000, status: 'partially_returned',
    });
  });
  it('forfeits when deductions exceed the balance', () => {
    const r = computeDepositReturn(1000, 0, [1500]);
    expect(r.refund).toBe(0);
    expect(r.status).toBe('forfeited');
  });
});
