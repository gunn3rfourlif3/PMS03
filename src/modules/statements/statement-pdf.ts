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
 * How far from a transaction a wrapped description line can sit. Further than
 * this it is something else — a page footer, a notice — and gluing it onto a
 * transaction would put "Page 1 of 2" in a tenant's payment description.
 */
const CONTINUATION_GAP = 20;
/**
 * Headings that wrap onto a second line ("Accrued / Bank / Charges") leave a
 * line of words just under the heading row. Closer than this, with no figures
 * in it and before the first transaction, it is still the heading.
 */
const HEADER_WRAP = 10;

/** A date at the START of a cell, and whatever follows it. */
const LEADING_DATE =
  /^(\d{1,2}[\s\-/]+[A-Za-z]{3,9}\.?(?:[\s\-/,]+\d{2,4})?|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?)(?:\s+(.+))?$/;

/** An empty money cell as banks print it. */
const PLACEHOLDER = /^[-–—]$/;

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
 *
 * TWO PASSES, because a wrapped description does not always wrap DOWNWARD.
 * Some banks (GoTyme) centre the date and amounts on a two-line description, so
 * one line of it sits above the date and one below. Gluing every text line onto
 * the transaction above it put the first half of each description on the
 * previous transaction. So first every line is classified, then each line of
 * plain text joins the transaction NEAREST to it on the page — above or below —
 * and a description is read top to bottom.
 */
export function rowsFromItems(items: PdfItem[]): string[][] {
  const lines = linesFromItems(items);
  const dates = datesInDocument(lines).sort();
  const latest = dates.length ? dates[dates.length - 1] : null;

  type Entry = { page: number; y: number; out: string[]; descOut: number; parts: { y: number; text: string }[] };
  type Text = { page: number; y: number; text: string };

  let headerNames: string[] | null = null;
  let cols: { name: string; lo: number; hi: number }[] = [];
  let toOutput: number[] = []; // this block's column -> output column
  let dateCol = -1;
  let descCol = -1;
  let moneyCols: number[] = [];
  let headerAt: { page: number; y: number } | null = null;
  let rowsInBlock = 0;
  const entries: Entry[] = [];
  const texts: Text[] = [];

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
        findColumn(names, STATEMENT_HEADERS.fee),
      ].filter((i) => i >= 0);
      headerAt = { page: line.page, y: line.y };
      rowsInBlock = 0;
      continue;
    }
    if (!headerNames || cols.length === 0) continue; // outside the table: bank details, address, summaries

    const lineText = line.cells.map((c) => c.text).join(' ');
    // The table ends at its closing balance. What follows on FNB statements is a
    // turnover summary ("No. Credit Transactions 1 · 50.00 Cr") printed under
    // the Amount column — read as transactions, its Dr marker also flipped the
    // sign rule and turned a R49 fee into a R49 credit.
    if (/\bclosing balance\b/i.test(lineText)) { cols = []; continue; }
    // The second line of a wrapped heading.
    if (rowsInBlock === 0 && headerAt && headerAt.page === line.page
      && headerAt.y - line.y <= HEADER_WRAP && !/\d/.test(lineText)) continue;

    // Position first, then what the cell SAYS. A heading can sit far from its
    // column's text: FNB centres "Description" well to the right of the
    // descriptions, which start straight after the date, so by position alone
    // the description fell under Date and the date became unreadable. Words
    // under Date that are not a date, and words under a money column that are
    // not money, belong in the description.
    const cellsByCol: string[] = cols.map(() => '');
    const put = (i: number, text: string) => {
      cellsByCol[i] = cellsByCol[i] ? `${cellsByCol[i]} ${text}` : text;
    };
    for (const cell of line.cells) {
      const i = columnFor(cell, cols);
      if (i === dateCol && descCol >= 0) {
        const m = cell.text.match(LEADING_DATE);
        if (m && statementDate(m[1], latest)) {
          put(i, m[1]);
          if (m[2]) put(descCol, m[2]);
        } else {
          put(descCol, cell.text);
        }
        continue;
      }
      if (moneyCols.includes(i) && descCol >= 0 && !PLACEHOLDER.test(cell.text) && parseMoney(cell.text) === null) {
        put(descCol, cell.text);
        continue;
      }
      put(i, cell.text);
    }
    // Money means a cell that READS as an amount. A centred page footer ("Page 1
    // of 2") falls under the amount column and has digits in it; it is not money.
    const hasMoney = moneyCols.some((i) => parseMoney(cellsByCol[i] ?? '') !== null);
    const whole = cellsByCol.join(' ').replace(/\s+/g, ' ').trim();
    const date = dateCol >= 0 ? statementDate(cellsByCol[dateCol], latest) : null;

    if (NOT_A_TRANSACTION.test(whole) && !hasMoney) continue; // opening / closing balance lines
    if (!date && !hasMoney) {
      if (whole) texts.push({ page: line.page, y: line.y, text: whole });
      continue;
    }

    // A transaction — or money with no date we can read, kept so the parser
    // reports it as unreadable instead of it vanishing silently.
    const out = headerNames.map(() => '');
    cellsByCol.forEach((v, i) => { if (toOutput[i] >= 0 && v) out[toOutput[i]] = v; });
    if (date) out[toOutput[dateCol]] = date;
    const descOut = descCol >= 0 ? toOutput[descCol] : -1;
    const own = descOut >= 0 ? out[descOut] : '';
    entries.push({ page: line.page, y: line.y, out, descOut, parts: own ? [{ y: line.y, text: own }] : [] });
    rowsInBlock++;
  }

  if (!headerNames) throw new StatementPdfError(PDF_NO_TABLE);

  // Each line of text joins the nearest transaction on its page, within reach.
  // A tie goes to the transaction above: the ordinary downward wrap.
  for (const t of texts) {
    let best: Entry | null = null;
    let bestDist = Infinity;
    for (const e of entries) {
      if (e.page !== t.page) continue;
      const dist = Math.abs(e.y - t.y);
      if (dist > CONTINUATION_GAP) continue;
      if (dist < bestDist || (dist === bestDist && best && e.y > best.y)) { best = e; bestDist = dist; }
    }
    best?.parts.push({ y: t.y, text: t.text });
  }

  for (const e of entries) {
    if (e.descOut < 0 || e.parts.length === 0) continue;
    e.out[e.descOut] = [...e.parts].sort((p, q) => q.y - p.y).map((p) => p.text).join(' ');
  }
  return [headerNames, ...entries.map((e) => e.out)];
}

/** Read a statement PDF into rows for `parseStatementRows`. */
export async function readPdfStatementRows(buf: Buffer): Promise<string[][]> {
  return rowsFromItems(await readPdfItems(buf));
}

/** True for a PDF, by name or by its first bytes. */
export function isPdf(filename: string, buf: Buffer): boolean {
  return /\.pdf$/i.test(filename ?? '') || buf?.subarray(0, 5).toString('latin1') === '%PDF-';
}
