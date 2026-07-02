import {
  assertBalanced, reverseLines, sumDebitsCents, sumCreditsCents,
  UnbalancedTransactionError, JournalLineInput,
} from '../src/modules/accounting/double-entry';

describe('double-entry engine', () => {
  const balanced: JournalLineInput[] = [
    { accountId: 'ar', debit: 1150 },
    { accountId: 'income', credit: 1000 },
    { accountId: 'vat', credit: 150 },
  ];

  it('accepts a balanced transaction', () => {
    expect(() => assertBalanced(balanced)).not.toThrow();
    expect(sumDebitsCents(balanced)).toBe(sumCreditsCents(balanced));
  });

  it('rejects an unbalanced transaction', () => {
    const bad = [
      { accountId: 'ar', debit: 1150 },
      { accountId: 'income', credit: 1000 },
    ];
    expect(() => assertBalanced(bad)).toThrow(UnbalancedTransactionError);
  });

  it('handles cents without float drift (0.1 + 0.2)', () => {
    const lines = [
      { accountId: 'a', debit: 0.3 },
      { accountId: 'b', credit: 0.1 },
      { accountId: 'c', credit: 0.2 },
    ];
    expect(() => assertBalanced(lines)).not.toThrow();
  });

  it('rejects a line with both debit and credit', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'a', debit: 10, credit: 10 },
        { accountId: 'b', credit: 10 },
      ]),
    ).toThrow();
  });

  it('reverses lines by swapping debit/credit', () => {
    const rev = reverseLines(balanced);
    expect(rev[0]).toMatchObject({ accountId: 'ar', debit: 0, credit: 1150 });
    expect(sumDebitsCents(rev)).toBe(sumCreditsCents(rev));
  });
});
