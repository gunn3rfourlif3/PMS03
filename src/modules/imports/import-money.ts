import { createHash } from 'node:crypto';
import { JournalLineInput } from '@modules/accounting/double-entry';
import { ResolvedRow } from './import-resolve';

/**
 * Turning a checked deposits or opening-balances file into the exact postings
 * it will make — without making them.
 *
 * Pure: no DB, no framework. This is the only part of the importer that moves
 * money into an append-only ledger, so the arithmetic has to be inspectable on
 * its own and provable in tests. The service resolves account ids and posts
 * what this returns; it makes no decisions of its own.
 */

export interface MoneyAccounts {
  accountsReceivable: string;
  openingBalanceEquity: string;
  trustBank: string;
  depositTrust: string;
}

export interface OpeningInvoice {
  leaseId: string;
  period: string;
  dueDate: string;
  total: number;
  description: string;
}

export interface DepositRecord {
  leaseId: string;
  amount: number;
  interest: number;
  heldIn: string;
  /** False when another party holds the money, so nothing is posted. */
  postsToTrust: boolean;
}

export interface MoneyPlan {
  /** One balanced journal for the whole batch, or empty when nothing posts. */
  lines: JournalLineInput[];
  invoices: OpeningInvoice[];
  deposits: DepositRecord[];
  totals: {
    rows: number;
    /** Rand owed by tenants (opening balances), net of credits. */
    owed: number;
    credits: number;
    /** Deposit money actually entering Locare's trust account. */
    intoTrust: number;
    /** Deposit money someone else is holding — recorded, never posted. */
    heldElsewhere: number;
  };
  /**
   * Fingerprint of the exact figures. Printed on the schedule the principal
   * signs, and checked again at commit — so a signature can only ever authorise
   * the numbers that were in front of them.
   */
  digest: string;
}

const round2 = (n: number): number => Math.round(Number(n || 0) * 100) / 100;
const money = (v: unknown): number => round2(Number(v ?? 0));

/** `2026-09-30` -> `2026-09`. */
export const periodOf = (isoDate: string): string => String(isoDate).slice(0, 7);

/** The rows a money file will actually act on. Blocked rows never post. */
const usable = (rows: ResolvedRow[]): ResolvedRow[] =>
  rows.filter((r) => r.action !== 'blocked' && r.action !== 'skip' && r.existingId);

export function planOpeningBalances(rows: ResolvedRow[], acc: MoneyAccounts): MoneyPlan {
  const lines: JournalLineInput[] = [];
  const invoices: OpeningInvoice[] = [];
  let owed = 0;
  let credits = 0;

  for (const row of usable(rows)) {
    const leaseId = row.existingId!;
    const balance = money(row.values.balance);
    if (balance === 0) continue;
    const asAt = String(row.values.asAt);

    // Positive means the tenant owes: Accounts Receivable goes up.
    // A credit balance is the mirror image.
    lines.push(balance > 0
      ? { accountId: acc.accountsReceivable, debit: balance, entityRef: `lease:${leaseId}` }
      : { accountId: acc.accountsReceivable, credit: -balance, entityRef: `lease:${leaseId}` });

    invoices.push({
      leaseId,
      period: periodOf(asAt),
      // Already owed on the day it was struck, so it ages from that date
      // rather than from the import.
      dueDate: asAt,
      total: balance,
      description: `Opening balance carried over at go-live (as at ${asAt})`,
    });

    if (balance > 0) owed = round2(owed + balance); else credits = round2(credits - balance);
  }

  // The contra side is EQUITY, never rental income. This rent was earned under
  // the previous agent; recognising it as income now would overstate this
  // period's income, and the management fee and VAT are both computed off
  // income — so the error would follow the money out of the business.
  const net = round2(owed - credits);
  if (net > 0) lines.push({ accountId: acc.openingBalanceEquity, credit: net, entityRef: 'import:opening-balances' });
  else if (net < 0) lines.push({ accountId: acc.openingBalanceEquity, debit: -net, entityRef: 'import:opening-balances' });
  // net === 0 needs no contra line: the debits and credits above already match.

  return {
    lines: lines.length >= 2 ? lines : [],
    invoices,
    deposits: [],
    totals: { rows: invoices.length, owed, credits, intoTrust: 0, heldElsewhere: 0 },
    digest: digestOf('opening_balances', invoices.map((i) => `${i.leaseId}|${i.total}|${i.dueDate}`)),
  };
}

export function planDeposits(rows: ResolvedRow[], acc: MoneyAccounts): MoneyPlan {
  const lines: JournalLineInput[] = [];
  const deposits: DepositRecord[] = [];
  let intoTrust = 0;
  let heldElsewhere = 0;

  for (const row of usable(rows)) {
    const leaseId = row.existingId!;
    const amount = money(row.values.amount);
    const interest = money(row.values.interestAccrued);
    const heldIn = String(row.values.heldBy ?? '');
    const postsToTrust = heldIn === 'locare_trust';
    const total = round2(amount + interest);

    deposits.push({ leaseId, amount, interest, heldIn, postsToTrust });

    if (!postsToTrust) {
      // Someone else is holding this money. Recording it as trust cash would
      // put Locare's trust bank out against the actual bank balance, which is
      // the one reconciliation a letting agency cannot afford to get wrong.
      heldElsewhere = round2(heldElsewhere + total);
      continue;
    }
    if (total === 0) continue;

    lines.push({ accountId: acc.trustBank, debit: total, entityRef: `lease:${leaseId}` });
    lines.push({ accountId: acc.depositTrust, credit: total, entityRef: `lease:${leaseId}` });
    intoTrust = round2(intoTrust + total);
  }

  return {
    lines: lines.length >= 2 ? lines : [],
    invoices: [],
    deposits,
    totals: { rows: deposits.length, owed: 0, credits: 0, intoTrust, heldElsewhere },
    digest: digestOf('deposits', deposits.map((d) => `${d.leaseId}|${d.amount}|${d.interest}|${d.heldIn}`)),
  };
}

/**
 * Order-independent, so the same figures in a different row order produce the
 * same fingerprint — an operator re-sorting a spreadsheet should not invalidate
 * a signature, but changing a number must.
 */
function digestOf(kind: string, parts: string[]): string {
  const canonical = [kind, ...[...parts].sort()].join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
