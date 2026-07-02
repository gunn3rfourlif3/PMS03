import { computeStatement } from '../src/modules/owners/statement-calc';

describe('owner statement calc', () => {
  it('nets out the management fee', () => {
    expect(computeStatement(10000, 0.1)).toEqual({
      grossCollected: 10000, managementFee: 1000, expenses: 0, netPayout: 9000,
    });
  });
  it('subtracts owner-billable expenses', () => {
    expect(computeStatement(10000, 0.1, 1500)).toEqual({
      grossCollected: 10000, managementFee: 1000, expenses: 1500, netPayout: 7500,
    });
  });
  it('never goes negative', () => {
    expect(computeStatement(1000, 0.1, 5000).netPayout).toBe(0);
  });
});
