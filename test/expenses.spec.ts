import { expensePeriod } from '../src/modules/expenses/expense-period';
import { computeStatement } from '../src/modules/owners/statement-calc';

describe('expense period + statement recovery', () => {
  it('buckets an expense date into its YYYY-MM period', () => {
    expect(expensePeriod('2026-07-14')).toBe('2026-07');
    expect(expensePeriod('2026-12-01')).toBe('2026-12');
  });

  it('owner statement stays ledger-balanced with expenses (gross = fee + net + expenses)', () => {
    const f = computeStatement(10000, 0.1, 1500);
    expect(f.managementFee + f.netPayout + f.expenses).toBe(f.grossCollected);
    expect(f.netPayout).toBe(7500);
  });
});
