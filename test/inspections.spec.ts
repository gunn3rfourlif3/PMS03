import { sumDeductions, deductionList } from '../src/modules/inspections/inspection-calc';

const items = [
  { area: 'Kitchen', condition: 'good' as const },
  { area: 'Bathroom', condition: 'damaged' as const, deductionAmount: 1500 },
  { area: 'Lounge', condition: 'poor' as const, deductionAmount: 500 },
  { area: 'Bedroom', condition: 'fair' as const, deductionAmount: 0 },
];

describe('inspection deductions', () => {
  it('sums positive deduction amounts', () => {
    expect(sumDeductions(items)).toBe(2000);
    expect(sumDeductions([])).toBe(0);
  });
  it('lists only positive deductions for the deposit return', () => {
    expect(deductionList(items)).toEqual([1500, 500]);
  });
});
