import { EntityManager } from 'typeorm';
import {
  planDeposits, planOpeningBalances, periodOf, MoneyAccounts,
} from '../src/modules/imports/import-money';
import { assertBalanced, sumDebitsCents, sumCreditsCents } from '../src/modules/accounting/double-entry';
import { resolveRows, ResolvedRow } from '../src/modules/imports/import-resolve';
import { entitySpec } from '../src/modules/imports/import-fields';
import { ParsedRow } from '../src/modules/imports/import-rows';

const ACC: MoneyAccounts = {
  accountsReceivable: 'acc-ar',
  openingBalanceEquity: 'acc-equity',
  trustBank: 'acc-trust-bank',
  depositTrust: 'acc-deposit-liab',
};

let n = 0;
const row = (values: Record<string, unknown>, over: Partial<ResolvedRow> = {}): ResolvedRow => ({
  rowNumber: ++n,
  values,
  key: null,
  issues: [],
  action: 'create',
  existingId: `lease-${n}`,
  summary: 'row',
  ...over,
});

const ob = (balance: number, asAt = '2026-09-30') => row({ balance, asAt, propertyName: 'Grove Court', unitLabel: '007' });
const dep = (amount: number, heldBy: string, interestAccrued = 0) =>
  row({ amount, heldBy, interestAccrued, propertyName: 'Grove Court', unitLabel: '007' });

/** Every plan must satisfy the ledger's own invariant, not ours. */
const expectBalanced = (lines: any[]) => {
  if (lines.length === 0) return;
  expect(() => assertBalanced(lines)).not.toThrow();
  expect(sumDebitsCents(lines)).toBe(sumCreditsCents(lines));
};

describe('opening balances', () => {
  it('debits what the tenant owes and credits equity, not income', () => {
    // Crediting rental income would overstate the period and inflate both the
    // management fee and the VAT computed off it.
    const p = planOpeningBalances([ob(18500), ob(4200)], ACC);
    expectBalanced(p.lines);
    const ar = p.lines.filter((l) => l.accountId === ACC.accountsReceivable);
    const eq = p.lines.filter((l) => l.accountId === ACC.openingBalanceEquity);
    expect(ar.map((l) => l.debit)).toEqual([18500, 4200]);
    expect(eq).toHaveLength(1);
    expect(eq[0].credit).toBe(22700);
    expect(p.lines.some((l) => l.accountId === 'acc-income')).toBe(false);
  });

  it('mirrors the entry for a tenant in credit', () => {
    const p = planOpeningBalances([ob(-1500)], ACC);
    expectBalanced(p.lines);
    expect(p.lines[0]).toMatchObject({ accountId: ACC.accountsReceivable, credit: 1500 });
    expect(p.lines[1]).toMatchObject({ accountId: ACC.openingBalanceEquity, debit: 1500 });
  });

  it('nets debtors against creditors and still balances', () => {
    const p = planOpeningBalances([ob(10000), ob(-2500), ob(500)], ACC);
    expectBalanced(p.lines);
    expect(p.totals.owed).toBe(10500);
    expect(p.totals.credits).toBe(2500);
    const eq = p.lines.find((l) => l.accountId === ACC.openingBalanceEquity)!;
    expect(eq.credit).toBe(8000);
  });

  it('needs no contra line when debits and credits already cancel', () => {
    // A contra of zero would be a line with neither a debit nor a credit, which
    // the ledger rejects outright.
    const p = planOpeningBalances([ob(3000), ob(-3000)], ACC);
    expectBalanced(p.lines);
    expect(p.lines.filter((l) => l.accountId === ACC.openingBalanceEquity)).toHaveLength(0);
    expect(p.lines).toHaveLength(2);
  });

  it('ignores blocked rows, skipped rows and zero balances', () => {
    const p = planOpeningBalances([
      ob(5000),
      row({ balance: 9999, asAt: '2026-09-30' }, { action: 'blocked' }),
      row({ balance: 8888, asAt: '2026-09-30' }, { action: 'skip' }),
      ob(0),
    ], ACC);
    expect(p.totals.owed).toBe(5000);
    expect(p.invoices).toHaveLength(1);
    expectBalanced(p.lines);
  });

  it('raises an invoice, because arrears are read from invoices not the ledger', () => {
    // Posted only to the ledger, an opening balance is invisible on the
    // dashboard while the tenant genuinely owes the money.
    const p = planOpeningBalances([ob(18500, '2026-09-30')], ACC);
    expect(p.invoices).toEqual([{
      leaseId: expect.any(String),
      period: '2026-09',
      dueDate: '2026-09-30',
      total: 18500,
      description: expect.stringContaining('2026-09-30'),
    }]);
  });

  it('ages the invoice from the date the balance was struck', () => {
    // Dating it "today" would put months-old arrears in the 0-30 bucket and
    // make a portfolio look far healthier than it is.
    const p = planOpeningBalances([ob(7000, '2026-03-31')], ACC);
    expect(p.invoices[0].dueDate).toBe('2026-03-31');
    expect(p.invoices[0].period).toBe('2026-03');
  });

  it('keeps cents exact across many rows', () => {
    const rows = [ob(0.1), ob(0.2), ob(1234.56), ob(0.05)];
    const p = planOpeningBalances(rows, ACC);
    expectBalanced(p.lines);
    expect(p.totals.owed).toBe(1234.91);
  });
});

describe('deposits', () => {
  it('posts only what actually lands in the Locare trust account', () => {
    const p = planDeposits([
      dep(9500, 'locare_trust'),
      dep(7000, 'landlord'),
      dep(5000, 'previous_agent'),
    ], ACC);
    expectBalanced(p.lines);
    expect(p.totals.intoTrust).toBe(9500);
    expect(p.totals.heldElsewhere).toBe(12000);
    expect(p.lines).toHaveLength(2);
  });

  it('records the money someone else holds without posting it', () => {
    // Recording a landlord-held deposit as trust cash puts the trust bank out
    // against the real bank balance — the one reconciliation an agency cannot
    // afford to get wrong.
    const p = planDeposits([dep(7000, 'landlord')], ACC);
    expect(p.lines).toHaveLength(0);
    expect(p.deposits).toEqual([
      { leaseId: expect.any(String), amount: 7000, interest: 0, heldIn: 'landlord', postsToTrust: false },
    ]);
  });

  it('carries accrued interest into the trust liability', () => {
    // RHA s5(3): the interest is the tenant's money, so it is part of what is
    // owed back, not agency income.
    const p = planDeposits([dep(9500, 'locare_trust', 412.3)], ACC);
    expectBalanced(p.lines);
    expect(p.lines.find((l) => l.accountId === ACC.trustBank)!.debit).toBe(9912.3);
    expect(p.lines.find((l) => l.accountId === ACC.depositTrust)!.credit).toBe(9912.3);
  });

  it('still records every deposit, whoever holds it', () => {
    const p = planDeposits([dep(1, 'locare_trust'), dep(2, 'landlord'), dep(3, 'tpn_or_other')], ACC);
    expect(p.deposits).toHaveLength(3);
    expect(p.totals.rows).toBe(3);
  });

  it('posts nothing at all when no deposit is in the trust account', () => {
    const p = planDeposits([dep(7000, 'landlord'), dep(5000, 'previous_agent')], ACC);
    expect(p.lines).toEqual([]);
  });
});

describe('the fingerprint on the signed schedule', () => {
  // Pinned lease ids: re-sorting a sheet must not change WHO owes WHAT, which
  // is exactly what a renumbering helper would do by accident.
  const pinned = (leaseId: string, balance: number): ResolvedRow =>
    row({ balance, asAt: '2026-09-30' }, { existingId: leaseId });

  it('does not change when the operator re-sorts the spreadsheet', () => {
    const a = planOpeningBalances([pinned('lease-a', 100), pinned('lease-b', 200)], ACC);
    const b = planOpeningBalances([pinned('lease-b', 200), pinned('lease-a', 100)], ACC);
    expect(a.digest).toBe(b.digest);
  });

  it('changes when a figure moves by a single cent', () => {
    const a = planOpeningBalances([pinned('lease-a', 100)], ACC);
    const b = planOpeningBalances([pinned('lease-a', 100.01)], ACC);
    expect(a.digest).not.toBe(b.digest);
  });

  it('changes when the same total is owed by a different tenant', () => {
    // The signature authorises a schedule of people, not just a number.
    const a = planOpeningBalances([pinned('lease-a', 100), pinned('lease-b', 200)], ACC);
    const b = planOpeningBalances([pinned('lease-a', 200), pinned('lease-b', 100)], ACC);
    expect(a.digest).not.toBe(b.digest);
  });

  it('differs between a deposits file and a balances file', () => {
    expect(planOpeningBalances([ob(100)], ACC).digest)
      .not.toBe(planDeposits([dep(100, 'locare_trust')], ACC).digest);
  });
});

describe('periodOf', () => {
  it('takes the month a balance was struck', () => {
    expect(periodOf('2026-09-30')).toBe('2026-09');
    expect(periodOf('2026-01-01')).toBe('2026-01');
  });
});

describe('importing an opening balance twice', () => {
  const spec = entitySpec('opening_balances');
  const parsed = (values: Record<string, unknown>): ParsedRow => ({
    rowNumber: 2, values, key: null, issues: [],
  });

  function manager(openedLeaseIds: string[]): EntityManager {
    const idx = (names: string[]) => names.map((k, i) => ({ id: `id-${k}-${i}`, k }));
    return {
      query: async (sql: string) => {
        if (sql.includes('line_items @>')) return openedLeaseIds.map((id) => ({ id }));
        if (sql.includes('FROM properties')) return idx(['Grove Court']);
        if (sql.includes('FROM units u JOIN properties')) return idx(['Grove Court · 007']);
        if (sql.includes('FROM leases l')) return idx(['Grove Court · 007']);
        return [];
      },
    } as unknown as EntityManager;
  }

  const ROW = { propertyName: 'Grove Court', unitLabel: '007', balance: 18500, asAt: '2026-09-30' };

  it('is blocked, because the ledger cannot be edited afterwards', async () => {
    const first = await resolveRows(manager([]), spec, [parsed(ROW)]);
    const leaseId = first.rows[0].existingId!;

    const second = await resolveRows(manager([leaseId]), spec, [parsed(ROW)]);
    expect(second.blocked).toBe(1);
    expect(second.rows[0].issues.map((i) => i.message).join(' '))
      .toMatch(/already been imported .* double what the tenant owes/);
  });

  it('allows the first import', async () => {
    const r = await resolveRows(manager([]), spec, [parsed(ROW)]);
    expect(r.blocked).toBe(0);
  });
});
