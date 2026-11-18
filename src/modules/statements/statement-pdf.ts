/**
 * Reading a bank statement PDF into the same rows a CSV gives.
 *
 * WHY POSITIONS, NOT TEXT. A PDF has no table in it, only words placed on a
 * page. Plain text extraction joins the words of a line with nothing between
 * them, so "1 500.00Cr" and the balance "12 345.67Cr" beside it come out as one
 * run of digits, and no rule can split them back reliably. So this reads every
 * word WITH its position, finds the statement's heading row (a date column and
 * an amount column, by the same names the CSV reader knows), and puts each word
 * in the column whose heading sits above it. The result is handed to
 * `parseStatementRows` exactly like a CSV — one parser, one matcher, one place
 * the rules live.
 *
 * WHAT IT REFUSES rather than guesses, each with a message staff can act on:
 * a scanned statement (no text in it — there is no OCR), a password-protected
 * one (South African banks often email them locked), and a PDF with no heading
 * row it can find. Nothing is recorded from a PDF either way: the bank-statement
 * screen previews every line, and staff confirm before anything is written.
 *
 * Works fully offline: pdf-parse is a local library, so this runs on a sealed
 * on-site installation with no internet.
 *
 * No bank-specific code. Layouts it has been tested against are in
 * test/statement-pdf.spec.ts; a real statement that defeats it should become a
 * new case there, not a special branch here.
 */
import { STATEMENT_HEADERS, findColumn, monthNumber, parseDate, parseMoney } from './statement-parse';

export class StatementPdfError extends Error {}

export const PDF_SCANNED =
  'This PDF has no readable text — it looks like a scanned statement. Download the statement from online banking instead (PDF, CSV or Excel).';
export const PDF_LOCKED =
  'This PDF is password-protected. Open it, save a copy without the password, and upload that.';
export const PDF_UNREADABLE = 'This PDF could not be read. Try downloading the statement again, or use CSV or Excel.';
export const PDF_NO_TABLE =
  'No transactions table found in this PDF: there is no heading row with a date and an amount column. Try the CSV or Excel download from your bank instead.';

/** One word, or run of words, as the PDF placed it. y grows UP the page. */
export interface PdfItem {
  page: number;
  x: number;
  y: number;
  w: number;
  str: string;
}

/** Same-line tolerance and the gap that separates two cells, in PDF points. */
const LINE_TOLERANCE = 2.5;
const CELL_GAP = 6;
/**
 * How far below a transaction a wrapped description line can sit. Further than
 * this it is something else — a page footer, a notice — and gluing it onto the
 * last transaction would put "Page 1 of 2" in a tenant's payment description.
 */
const CONTINUATION_GAP = 20;

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Every text item with its position. Throws StatementPdfError for scans and locked files. */
export async function readPdfItems(buf: Buffer): Promise<PdfItem[]> {
  // Required lazily so pdf-parse never loads unless a PDF is actually read.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const items: PdfItem[] = [];
  let page = 0;
  // A COPY of the bytes, in their own memory. Node packs small buffers into one
  // shared block, and the bundled pdf.js reads that whole block without
  // honouring where this file starts — so a small PDF could be read as a
  // different file uploaded just before it. Found by the tests, where it did.
  const bytes = Uint8Array.from(buf);
  try {
    await pdfParse(bytes, {
      pagerender: async (pageData: any) => {
        const p = ++page;
        const content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
        for (const it of content.items ?? []) {
          const str = String(it.str ?? '');
          if (!str.trim()) continue;
          items.push({ page: p, x: it.transform[4], y: it.transform[5], w: Number(it.width) || 0, str });
        }
        return '';
      },
    });
  } catch (e: any) {
    if (/password|encrypt/i.test(`${e?.name ?? ''} ${e?.message ?? ''}`)) throw new StatementPdfError(PDF_LOCKED);
    throw new StatementPdfError(PDF_UNREADABLE);
  }
  if (items.length === 0) throw new StatementPdfError(PDF_SCANNED);
  return items;
}

interface Cell { x0: number; x1: number; text: string }
interface Line { page: number; y: number; cells: Cell[] }

/** Group items into lines, top to bottom, and each line into cells by the gaps between words. */
export function linesFromItems(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: { page: number; y: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === it.page && Math.abs(last.y - it.y) <= LINE_TOLERANCE) last.items.push(it);
    else lines.push({ page: it.page, y: it.y, items: [it] });
  }
  return lines.map((l) => {
    const cells: Cell[] = [];
    for (const it of [...l.items].sort((a, b) => a.x - b.x)) {
      const prev = cells[cells.length - 1];
      const gap = prev ? it.x - prev.x1 : Infinity;
      if (prev && gap <= CELL_GAP) {
        prev.text += (gap > 1 ? ' ' : '') + it.str;
        prev.x1 = Math.max(prev.x1, it.x + it.w);
      } else {
        cells.push({ x0: it.x, x1: it.x + it.w, text: it.str });
      }
    }
    for (const c of cells) c.text = c.text.replace(/\s+/g, ' ').trim();
    return { page: l.page, y: l.y, cells };
  });
}

/** A heading row: three or more cells, one naming a date column and one an amount or money-in column. */
function isHeader(line: Line): boolean {
  if (line.cells.length < 3) return false;
  const texts = line.cells.map((c) => c.text);
  // Headings are words. A transaction line that happens to mention "date" in
  // its description still carries figures; a heading row does not.
  if (texts.some((t) => /\d/.test(t))) return false;
  return findColumn(texts, STATEMENT_HEADERS.date) >= 0
    && (findColumn(texts, STATEMENT_HEADERS.amount) >= 0 || findColumn(texts, STATEMENT_HEADERS.credit) >= 0);
}

/** Column spans from a heading row: each column runs to the midpoint of the gap to its neighbours. */
function columnsFrom(header: Line): { name: string; lo: number; hi: number }[] {
  const cs = header.cells;
  return cs.map((c, i) => ({
    name: c.text,
    lo: i === 0 ? -Infinity : (cs[i - 1].x1 + c.x0) / 2,
    hi: i === cs.length - 1 ? Infinity : (c.x1 + cs[i + 1].x0) / 2,
  }));
}

function columnFor(cell: Cell, cols: { lo: number; hi: number }[]): number {
  let best = 0;
  let bestOverlap = -Infinity;
  cols.forEach((col, i) => {
    const overlap = Math.min(cell.x1, col.hi) - Math.max(cell.x0, col.lo);
    if (overlap > bestOverlap) { bestOverlap = overlap; best = i; }
  });
  return best;
}

/** Every full date written anywhere in the document, for working out the year of "15 Nov". */
function datesInDocument(lines: Line[]): string[] {
  const found: string[] = [];
  for (const l of lines) {
    const text = l.cells.map((c) => c.text).join(' ');
    for (const m of text.matchAll(/\b(\d{1,2}[\s\-/]+[A-Za-z]{3,9}\.?[\s\-/,]+20\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.]20\d{2}|20\d{2}[/\-.]\d{1,2}[/\-.]\d{1,2})\b/g)) {
      const d = parseDate(m[1]);
      if (d) found.push(d);
    }
  }
  return found;
}

/**
 * A transaction date as ISO. Statements often print the day and month only
 * ("15 Nov"); the year then comes from the latest full date on the statement
 * (its period end), stepping back a year for a date that would otherwise fall
 * well after the statement — a December line on a statement ending in January.
 * Null when there is no year to be had: the row is then reported as having an
 * unreadable date, never given this year's by default.
 */
export function statementDate(raw: string, latest: string | null): string | null {
  const full = parseDate(raw);
  if (full) return full;
  if (!latest) return null;
  const s = raw.trim();
  let day: number | null = null;
  let month: number | null = null;
  const named = s.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,9})\.?$/);
  const numeric = s.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (named) { day = Number(named[1]); month = monthNumber(named[2]); }
  else if (numeric) { day = Number(numeric[1]); month = Number(numeric[2]); }
  if (!day || !month) return null;
  const latestYear = Number(latest.slice(0, 4));
  for (const year of [latestYear, latestYear - 1]) {
    const candidate = parseDate(`${year}/${month}/${day}`);
    if (!candidate) return null;
    const ahead = (Date.parse(candidate) - Date.parse(latest)) / 86400000;
    if (ahead <= 45) return candidate;
  }
  return null;
}

/** Lines that summarise rather than record money moving. */
const NOT_A_TRANSACTION = /\b(opening|closing|brought forward|carried forward|balance b\/f|balance c\/f|total)\b/i;

/**
 * The statement as rows, heading row first — the shape `parseStatementRows`
 * reads. Pure: positions in, rows out.
 */
export function rowsFromItems(items: PdfItem[]): string[][] {
  const lines = linesFromItems(items);
  const dates = datesInDocument(lines).sort();
  const latest = dates.length ? dates[dates.length - 1] : null;

  let headerNames: string[] | null = null;
  let cols: { name: string; lo: number; hi: number }[] = [];
  let toOutput: number[] = []; // this block's column -> output column
  let dateCol = -1;
  let descCol = -1;
  let moneyCols: number[] = [];
  const rows: string[][] = [];
  let current: string[] | null = null;
  let currentAt: { page: number; y: number } | null = null;

  for (const line of lines) {
    if (isHeader(line)) {
      cols = columnsFrom(line);
      const names = cols.map((c) => c.name);
      if (!headerNames) headerNames = names;
      // A heading repeated on the next page lines up with the first by name.
      toOutput = names.map((n) => headerNames!.findIndex((h) => norm(h) === norm(n)));
      dateCol = findColumn(names, STATEMENT_HEADERS.date);
      descCol = findColumn(names, STATEMENT_HEADERS.description);
      moneyCols = [
        findColumn(names, STATEMENT_HEADERS.amount),
        findColumn(names, STATEMENT_HEADERS.credit),
        findColumn(names, STATEMENT_HEADERS.debit),
      ].filter((i) => i >= 0);
      current = null;
      continue;
    }
    if (!headerNames || cols.length === 0) continue; // above the table: bank details, address, period

    const cellsByCol: string[] = cols.map(() => '');
    for (const cell of line.cells) {
      const i = columnFor(cell, cols);
      cellsByCol[i] = cellsByCol[i] ? `${cellsByCol[i]} ${cell.text}` : cell.text;
    }
    // Money means a cell that READS as an amount. A centred page footer ("Page 1
    // of 2") falls under the amount column and has digits in it; it is not money.
    const hasMoney = moneyCols.some((i) => parseMoney(cellsByCol[i] ?? '') !== null);
    const whole = cellsByCol.join(' ');
    const date = dateCol >= 0 ? statementDate(cellsByCol[dateCol], latest) : null;

    if (date) {
      const out = headerNames.map(() => '');
      cellsByCol.forEach((v, i) => { if (toOutput[i] >= 0 && v) out[toOutput[i]] = v; });
      out[toOutput[dateCol]] = date;
      if (!hasMoney && NOT_A_TRANSACTION.test(whole)) { current = null; continue; }
      rows.push(out);
      current = out;
      currentAt = { page: line.page, y: line.y };
      continue;
    }

    if (NOT_A_TRANSACTION.test(whole)) { current = null; continue; }

    if (!hasMoney) {
      // A description that wrapped onto a second line belongs to the line above.
      const close = currentAt && currentAt.page === line.page && currentAt.y - line.y <= CONTINUATION_GAP;
      if (current && close && descCol >= 0 && toOutput[descCol] >= 0 && whole.trim()) {
        const o = toOutput[descCol];
        current[o] = current[o] ? `${current[o]} ${whole.trim()}` : whole.trim();
        currentAt = { page: line.page, y: line.y };
      }
      continue;
    }

    // Money but no date we can read. Keep it, with the date cell as written, so
    // the parser reports it as unreadable instead of it vanishing silently.
    const out = headerNames.map(() => '');
    cellsByCol.forEach((v, i) => { if (toOutput[i] >= 0 && v) out[toOutput[i]] = v; });
    rows.push(out);
    current = null;
  }

  if (!headerNames) throw new StatementPdfError(PDF_NO_TABLE);
  return [headerNames, ...rows];
}

/** Read a statement PDF into rows for `parseStatementRows`. */
export async function readPdfStatementRows(buf: Buffer): Promise<string[][]> {
  return rowsFromItems(await readPdfItems(buf));
}

/** True for a PDF, by name or by its first bytes. */
export function isPdf(filename: string, buf: Buffer): boolean {
  return /\.pdf$/i.test(filename ?? '') || buf?.subarray(0, 5).toString('latin1') === '%PDF-';
}
