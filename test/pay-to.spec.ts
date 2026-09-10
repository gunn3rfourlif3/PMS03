/**
 * Locare's banking details are read from the environment, never committed. The
 * assertions that matter are the safe-by-default ones: a deployment with no
 * account configured must show nothing at all, rather than a partial set of
 * details an agency might try to pay into.
 */
import { payToDetails, payToReference } from '@common/config/pay-to';

const set = (k: string, v?: string) => {
  if (v === undefined) delete (process.env as Record<string, string>)[k];
  else (process.env as Record<string, string>)[k] = v;
};

describe('payToDetails', () => {
  beforeEach(() => {
    for (const k of ['PAYTO_BANK', 'PAYTO_ACCOUNT_NAME', 'PAYTO_ACCOUNT_NUMBER', 'PAYTO_BRANCH_CODE', 'PAYTO_SWIFT']) set(k, undefined);
  });

  it('is null when nothing is configured', () => {
    expect(payToDetails()).toBeNull();
  });

  it.each([
    ['no account number', undefined, '250655'],
    ['no branch code', '62000000000', undefined],
    ['blank account number', '   ', '250655'],
  ])('is null with %s', (_label, acct, branch) => {
    set('PAYTO_ACCOUNT_NUMBER', acct);
    set('PAYTO_BRANCH_CODE', branch);
    expect(payToDetails()).toBeNull();
  });

  it('returns the details once both required fields are set', () => {
    set('PAYTO_ACCOUNT_NUMBER', '62000000000');
    set('PAYTO_BRANCH_CODE', '250655');
    expect(payToDetails()).toEqual({
      bank: 'First National Bank',
      accountName: 'Locare (Pty) Ltd',
      accountNumber: '62000000000',
      branchCode: '250655',
      swift: undefined,
    });
  });

  it('carries SWIFT only when set', () => {
    set('PAYTO_ACCOUNT_NUMBER', '62000000000');
    set('PAYTO_BRANCH_CODE', '250655');
    set('PAYTO_SWIFT', 'FIRNZAJJ');
    expect(payToDetails()?.swift).toBe('FIRNZAJJ');
  });
});

describe('payToReference', () => {
  // Reconciliation is a human reading a bank statement, and bank reference
  // fields are short — so the reference must identify agency and period and
  // survive a 20-character limit.
  it('is human-readable and identifies agency and period', () => {
    expect(payToReference('dantalan', '2026-09')).toBe('DANTALAN-2026-09');
  });

  it('strips punctuation a bank field would mangle', () => {
    expect(payToReference('acme-rentals.co', '2026-09')).toBe('ACMERENTALSC-2026-09');
  });

  it('stays within a bank reference field', () => {
    expect(payToReference('a-very-long-agency-name', '2026-09').length).toBeLessThanOrEqual(20);
  });

  it('falls back rather than producing a bare period', () => {
    expect(payToReference(null, '2026-09')).toBe('AGENCY-2026-09');
  });
});
