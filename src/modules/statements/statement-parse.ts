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

/**
 * Header synonyms, in the order they are preferred. Exported because the PDF
 * reader finds a statement's table by the same names (see statement-pdf.ts).
 */
export const STATEMENT_HEADERS: Record<'date' | 'description' | 'reference' | 'amount' | 'credit' | 'debit' | 'fee', string[]> = {
  date: ['date', 'transactiondate', 'postingdate', 'valuedate', 'effectivedate'],
  description: ['description', 'details', 'narrative', 'transactiondescription', 'memo'],
  reference: ['reference', 'ref', 'payerreference', 'yourreference', 'customerreference', 'paymentreference'],
  amount: ['amount', 'transactionamount', 'value'],
  credit: ['credit', 'creditamount', 'moneyin', 'deposit', 'receipts'],
  // `payments` is matched whole, never by contains, so a "Payment reference"
  // column cannot be mistaken for money out.
  debit: ['debit', 'debitamount', 'moneyout', 'withdrawal', 'payments'],
  // Bank charges in a column of their own (GoTyme: "Fees*(-)"). Always money out.
  fee: ['fees', 'fee', 'charges', 'servicefee', 'bankcharges'],
};
const HEADERS = STATEMENT_HEADERS;

export interface ParseResult {
  lines: StatementLine[];
  /**
   * Rows that could not be read, with the reason. Never silently dropped.
   * `text` is what the row said, so staff can find it on the statement — a row
   * number means nothing to someone holding a PDF.
   */
  skipped: { row: number; reason: string; text?: string }[];
  /** Which column each field was taken from, so the screen can show its working. */
  mapping: Record<string, string>;
}

/** Names too risky to match inside a longer header ("Payments reference"). */
const WHOLE_WORD_ONLY = new Set(['payments']);

export function findColumn(headers: string[], names: string[]): number {
  const normed = headers.map(norm);
  for (const name of names) {
    const i = normed.indexOf(name);
    if (i >= 0) return i;
  }
  // Fall back to a contains match: "Transaction Date (CAT)" should still count.
  for (const name of names) {
    if (WHOLE_WORD_ONLY.has(name)) continue;
    const i = normed.findIndex((h) => h.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * The Cr / Dr marker some banks print after an amount ("1 500.00Cr"), or null.
 * FNB-style statements mark credits and leave debits bare, which is why the
 * marker is read separately: see `parseStatementRows`.
 */
export function moneyMarker(raw: string): 'cr' | 'dr' | null {
  const m = (raw ?? '').trim().match(/(?:^|[\d\s.)])(cr|dr)\.?$/i);
  return m ? (m[1].toLowerCase() as 'cr' | 'dr') : null;
}

/**
 * "R 1 234,56" / "1,234.56" / "(500.00)" / "1 500.00Cr" / "250.00-" -> a number.
 * Returns null if unreadable. A Cr marker makes it positive, Dr negative.
 *
 * The marker has to come off BEFORE the currency symbol is stripped: that strip
 * removes every R, and "Cr" contains one — "1500.00Cr" used to become
 * "1500.00C", which is not a number, and the row was reported unreadable.
 */
export function parseMoney(raw: string): number | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  const marker = moneyMarker(s);
  if (marker) s = s.replace(/\s*(cr|dr)\.?$/i, '');
  const trailingMinus = /-$/.test(s);
  if (trailingMinus) s = s.slice(0, -1).trim();
  const negated = trailingMinus || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/[R\s ]/gi, '');
  // Decimal comma (common in SA exports): 1.234,56 -> 1234.56
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (marker === 'cr') return Math.abs(n);
  if (marker === 'dr') return -Math.abs(n);
  return negated ? -Math.abs(n) : n;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "Nov", "November", "Sept" -> 11 / 9, or null. */
export function monthNumber(word: string): number | null {
  const w = (word ?? '').toLowerCase();
  if (w.length < 3) return null;
  return MONTHS[w.slice(0, 3)] ?? null;
}

const iso = (y: number, m: number, d: number): string | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1) return null; // 31 November
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/** ISO, or dd/mm/yyyy which is what SA banks export. Returns null if unreadable. */
export function parseDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Year first with slashes or dots, as some statements print it: 2026/11/03.
  const ymd = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (ymd) return iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  // Month as a word: 3 Nov 2026, 03-Nov-2026, 3 November 2026.
  const named = s.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,9})\.?[\s\-/,]+(\d{2,4})$/);
  if (named) {
    const mo = monthNumber(named[2]);
    const yr = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
    return mo ? iso(yr, mo, Number(named[1])) : null;
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    // Day-first. A SA bank exporting month-first would be read wrong here, which
    // is why the screen shows the parsed dates back before anything is committed.
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Last resort, and only when the text states a four-digit year: given "15 Nov"
  // the engine silently picks 2001, so a statement line would land 25 years in
  // the past and match nothing. Read back in LOCAL time: Date.parse reads a
  // string like this as local midnight, and converting to UTC on a server ahead
  // of UTC (South Africa is +2) lands on the previous day.
  if (!/\b\d{4}\b/.test(s)) return null;
  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

export function parseStatementRows(rows: string[][]): ParseResult {
  const skipped: { row: number; reason: string; text?: string }[] = [];
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
    fee: findColumn(headers, HEADERS.fee),
  };
  // A fees column is only a fees column if it is not one already claimed.
  if ([col.date, col.description, col.reference, col.amount, col.credit, col.debit].includes(col.fee)) col.fee = -1;

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

  // One amount column with Cr/Dr markers on only SOME values: the bank marks one
  // direction and leaves the other bare. FNB-style statements mark credits
  // ("1 500.00Cr") and print debits plain, so a bare figure there is money OUT.
  // Read as written it would be a positive amount, and a debit could then be
  // matched to an invoice as if a tenant had paid it.
  let bareSign: 1 | -1 | null = null;
  if (col.amount >= 0) {
    const markers = rows.slice(1).map((row) => moneyMarker(String(row?.[col.amount] ?? '')));
    const hasCr = markers.includes('cr');
    const hasDr = markers.includes('dr');
    if (hasCr && !hasDr) bareSign = -1;
    if (hasDr && !hasCr) bareSign = 1;
  }

  const lines: StatementLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const text = row.map((c) => String(c ?? '').trim()).filter((c) => c && c !== '-').join(' · ').slice(0, 140);
    const date = parseDate(String(row[col.date] ?? ''));
    if (!date) { skipped.push({ row: r + 1, reason: 'Unreadable date', text }); continue; }

    let amount: number | null = null;
    if (col.amount >= 0) {
      const raw = String(row[col.amount] ?? '');
      amount = parseMoney(raw);
      if (amount !== null && bareSign !== null && moneyMarker(raw) === null) amount = bareSign * Math.abs(amount);
    }
    if (amount === null && col.credit >= 0) amount = parseMoney(String(row[col.credit] ?? ''));
    // A separate debit column means the row is money out; keep it negative so the
    // matcher reports it as not-a-credit rather than dropping it unexplained.
    if (amount === null && col.debit >= 0) {
      const d = parseMoney(String(row[col.debit] ?? ''));
      if (d !== null) amount = -Math.abs(d);
    }
    if (amount === null && col.fee >= 0) {
      const f = parseMoney(String(row[col.fee] ?? ''));
      if (f !== null) amount = -Math.abs(f);
    }
    if (amount === null) { skipped.push({ row: r + 1, reason: 'Unreadable amount', text }); continue; }

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
