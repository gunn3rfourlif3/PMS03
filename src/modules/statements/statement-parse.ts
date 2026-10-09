/**
 * Turning a bank's CSV into statement lines.
 *
 * Pure, and separate from the matching, because every bank exports a different
 * shape and the header-guessing is the part that will need changing most often.
 *
 * No bank-specific parsers. A header map that recognises the common names
 * covers FNB, Standard Bank, Absa and Nedbank exports well enough, and anything
 * it cannot read is reported as unreadable rather than guessed at — a column
 * silently read as the wrong field is how money lands on the wrong invoice.
 */
import { StatementLine } from '@providers/payment/statement-import';

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Header synonyms, in the order they are preferred. */
const HEADERS: Record<'date' | 'description' | 'reference' | 'amount' | 'credit' | 'debit', string[]> = {
  date: ['date', 'transactiondate', 'postingdate', 'valuedate', 'effectivedate'],
  description: ['description', 'details', 'narrative', 'transactiondescription', 'memo'],
  reference: ['reference', 'ref', 'payerreference', 'yourreference', 'customerreference', 'paymentreference'],
  amount: ['amount', 'transactionamount', 'value'],
  credit: ['credit', 'creditamount', 'moneyin', 'deposit'],
  debit: ['debit', 'debitamount', 'moneyout', 'withdrawal'],
};

export interface ParseResult {
  lines: StatementLine[];
  /** Rows that could not be read, with the reason. Never silently dropped. */
  skipped: { row: number; reason: string }[];
  /** Which column each field was taken from, so the screen can show its working. */
  mapping: Record<string, string>;
}

function findColumn(headers: string[], names: string[]): number {
  const normed = headers.map(norm);
  for (const name of names) {
    const i = normed.indexOf(name);
    if (i >= 0) return i;
  }
  // Fall back to a contains match: "Transaction Date (CAT)" should still count.
  for (const name of names) {
    const i = normed.findIndex((h) => h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

/** "R 1 234,56" / "1,234.56" / "(500.00)" -> a number. Returns null if unreadable. */
export function parseMoney(raw: string): number | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  const negated = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/[R\s ]/gi, '');
  // Decimal comma (common in SA exports): 1.234,56 -> 1234.56
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negated ? -Math.abs(n) : n;
}

/** ISO, or dd/mm/yyyy which is what SA banks export. Returns null if unreadable. */
export function parseDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    // Day-first. A SA bank exporting month-first would be read wrong here, which
    // is why the screen shows the parsed dates back before anything is committed.
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

export function parseStatementRows(rows: string[][]): ParseResult {
  const skipped: { row: number; reason: string }[] = [];
  if (!rows || rows.length < 2) {
    return { lines: [], skipped: [{ row: 0, reason: 'The file has no rows below its header' }], mapping: {} };
  }

  const headers = rows[0].map((h) => String(h ?? ''));
  const col = {
    date: findColumn(headers, HEADERS.date),
    description: findColumn(headers, HEADERS.description),
    reference: findColumn(headers, HEADERS.reference),
    amount: findColumn(headers, HEADERS.amount),
    credit: findColumn(headers, HEADERS.credit),
    debit: findColumn(headers, HEADERS.debit),
  };

  const mapping: Record<string, string> = {};
  for (const [field, idx] of Object.entries(col)) {
    if (idx >= 0) mapping[field] = headers[idx];
  }

  if (col.date < 0) {
    return { lines: [], skipped: [{ row: 0, reason: 'No date column found' }], mapping };
  }
  if (col.amount < 0 && col.credit < 0) {
    return { lines: [], skipped: [{ row: 0, reason: 'No amount or credit column found' }], mapping };
  }

  const lines: StatementLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const date = parseDate(String(row[col.date] ?? ''));
    if (!date) { skipped.push({ row: r + 1, reason: 'Unreadable date' }); continue; }

    let amount: number | null = null;
    if (col.amount >= 0) amount = parseMoney(String(row[col.amount] ?? ''));
    if (amount === null && col.credit >= 0) amount = parseMoney(String(row[col.credit] ?? ''));
    // A separate debit column means the row is money out; keep it negative so the
    // matcher reports it as not-a-credit rather than dropping it unexplained.
    if (amount === null && col.debit >= 0) {
      const d = parseMoney(String(row[col.debit] ?? ''));
      if (d !== null) amount = -Math.abs(d);
    }
    if (amount === null) { skipped.push({ row: r + 1, reason: 'Unreadable amount' }); continue; }

    lines.push({
      id: `row-${r + 1}`,
      date,
      description: col.description >= 0 ? String(row[col.description] ?? '') : undefined,
      reference: col.reference >= 0 ? String(row[col.reference] ?? '') : undefined,
      amount,
    });
  }

  return { lines, skipped, mapping };
}
