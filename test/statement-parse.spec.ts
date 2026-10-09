import { parseStatementRows, parseMoney, parseDate } from '../src/modules/statements/statement-parse';

describe('money', () => {
  it('reads plain and thousand-separated figures', () => {
    expect(parseMoney('1234.56')).toBe(1234.56);
    expect(parseMoney('1,234.56')).toBe(1234.56);
  });

  // SA exports often use a decimal comma. Reading "1.234,56" as 1.234 would
  // turn eight thousand rand into eight.
  it('reads a decimal comma', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('8500,00')).toBe(8500);
  });

  it('strips the currency symbol and non-breaking spaces', () => {
    expect(parseMoney('R 8 500.00')).toBe(8500);
    expect(parseMoney('R 8500')).toBe(8500);
  });

  it('treats brackets as negative', () => {
    expect(parseMoney('(500.00)')).toBe(-500);
  });

  it('returns null rather than zero for nonsense', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('n/a')).toBeNull();
  });
});

describe('dates', () => {
  it('reads ISO', () => {
    expect(parseDate('2026-10-02')).toBe('2026-10-02');
  });

  it('reads day-first, which is what SA banks export', () => {
    expect(parseDate('02/10/2026')).toBe('2026-10-02');
    expect(parseDate('2-10-26')).toBe('2026-10-02');
  });

  it('returns null rather than today for nonsense', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('reading a statement', () => {
  const rows = [
    ['Date', 'Description', 'Reference', 'Amount'],
    ['02/10/2026', 'EFT CREDIT', 'RENT11111111', '8500.00'],
    ['03/10/2026', 'BANK CHARGES', '', '(120.00)'],
  ];

  it('maps the common header names and says which it used', () => {
    const r = parseStatementRows(rows);
    expect(r.lines).toHaveLength(2);
    expect(r.mapping.date).toBe('Date');
    expect(r.mapping.reference).toBe('Reference');
  });

  it('keeps a debit as negative so the matcher can call it not-a-credit', () => {
    const r = parseStatementRows(rows);
    expect(r.lines[1].amount).toBe(-120);
  });

  it('recognises alternative header names', () => {
    const r = parseStatementRows([
      ['Transaction Date', 'Narrative', 'Payment Reference', 'Money In'],
      ['02/10/2026', 'EFT', 'RENT1', '8500'],
    ]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].amount).toBe(8500);
  });

  // A row dropped without explanation is money nobody knows is missing.
  it('reports unreadable rows rather than dropping them', () => {
    const r = parseStatementRows([
      ['Date', 'Amount'],
      ['nonsense', '100'],
      ['02/10/2026', 'nonsense'],
    ]);
    expect(r.lines).toHaveLength(0);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0].reason).toContain('date');
    expect(r.skipped[1].reason).toContain('amount');
  });

  it('refuses a file with no date column instead of guessing one', () => {
    const r = parseStatementRows([['Something', 'Amount'], ['x', '100']]);
    expect(r.lines).toHaveLength(0);
    expect(r.skipped[0].reason).toContain('No date column');
  });

  it('refuses a file with no amount column', () => {
    const r = parseStatementRows([['Date', 'Description'], ['02/10/2026', 'x']]);
    expect(r.skipped[0].reason).toContain('No amount');
  });

  it('handles an empty file', () => {
    expect(parseStatementRows([]).lines).toHaveLength(0);
  });
});
