/**
 * Pure double-entry helpers — no framework/DB deps, so the accounting invariant
 * is unit-testable in isolation.
 *
 * Money is validated in integer CENTS to avoid floating-point drift (0.1 + 0.2
 * problems). Callers pass amounts in major units (Rands); we convert internally.
 */

export interface JournalLineInput {
  accountId: string;
  /** Debit amount in major units (>= 0). Exactly one of debit/credit is > 0. */
  debit?: number;
  /** Credit amount in major units (>= 0). */
  credit?: number;
  entityRef?: string;
}

export class UnbalancedTransactionError extends Error {
  constructor(debits: number, credits: number) {
    super(
      `Unbalanced transaction: debits=${debits / 100} credits=${credits / 100}`,
    );
    this.name = 'UnbalancedTransactionError';
  }
}

const toCents = (n: number): number => Math.round(n * 100);

export function sumDebitsCents(lines: JournalLineInput[]): number {
  return lines.reduce((s, l) => s + toCents(l.debit ?? 0), 0);
}

export function sumCreditsCents(lines: JournalLineInput[]): number {
  return lines.reduce((s, l) => s + toCents(l.credit ?? 0), 0);
}

/**
 * Validate a set of journal lines:
 *  - at least two lines,
 *  - each line has exactly one non-zero side, no negatives,
 *  - total debits === total credits.
 * Throws on violation; returns nothing on success.
 */
export function assertBalanced(lines: JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new Error('A transaction needs at least two lines');
  }
  for (const l of lines) {
    const d = l.debit ?? 0;
    const c = l.credit ?? 0;
    if (d < 0 || c < 0) throw new Error('Amounts must be non-negative');
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error('Each line must have exactly one of debit or credit');
    }
  }
  const debits = sumDebitsCents(lines);
  const credits = sumCreditsCents(lines);
  if (debits !== credits) throw new UnbalancedTransactionError(debits, credits);
}

/** Produce the reversing lines for a set (swap debit <-> credit). */
export function reverseLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit ?? 0,
    credit: l.debit ?? 0,
    entityRef: l.entityRef,
  }));
}
