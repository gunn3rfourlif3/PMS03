// Namespace import, not default: this project has esModuleInterop OFF, so a
// default import of a CommonJS module compiles to `require(...).default`
// and is undefined at runtime. allowSyntheticDefaultImports hides that from
// the compiler, so it only shows up when the code actually runs.
import * as ExcelJS from 'exceljs';

/**
 * Getting rows out of whatever the agency sent.
 *
 * `.xlsx` is the preferred path and not merely for convenience: cells arrive
 * TYPED, so a date is a Date and `007` is still text. A CSV export is where the
 * damage happens — leading zeros vanish, dates take on the machine's regional
 * format, and phone numbers turn into scientific notation. We accept CSV
 * because agencies send it, and `import-values.ts` repairs what it can.
 */

export interface SheetData {
  name: string;
  /** Row zero as strings — the header row. */
  headers: string[];
  /** Everything after the header, cells left in their spreadsheet type. */
  rows: unknown[][];
}

/** Largest file we will read. A 60-unit agency is a few tens of kilobytes. */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
/** Guard against someone uploading a 200k-row export by mistake. */
export const MAX_IMPORT_ROWS = 5000;

export class ImportReadError extends Error {}

/** A spreadsheet cell as a plain value: Date, number, boolean, string or null. */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    // Formula cells carry their computed result; hyperlinks carry text; rich
    // text is a run of fragments. Take what a human would see in the cell.
    if ('result' in o) return cellValue(o.result as ExcelJS.CellValue);
    if ('text' in o) return o.text;
    if ('richText' in o) return (o.richText as Array<{ text: string }>).map((r) => r.text).join('');
    if ('error' in o) return null;
    return null;
  }
  return v;
}

const trailingBlanks = (row: unknown[]): unknown[] => {
  let end = row.length;
  while (end > 0 && (row[end - 1] === null || row[end - 1] === undefined || row[end - 1] === '')) end -= 1;
  return row.slice(0, end);
};

const isEmptyRow = (row: unknown[]): boolean =>
  row.every((c) => c === null || c === undefined || (typeof c === 'string' && c.trim() === ''));

async function readXlsx(buf: Buffer): Promise<SheetData[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const out: SheetData[] = [];

  wb.eachSheet((ws) => {
    const raw: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      // values is 1-based with a leading hole; drop it.
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
      raw.push(trailingBlanks(values));
    });
    // A header row followed by nothing is not a sheet worth offering.
    const rows = raw.filter((r) => !isEmptyRow(r));
    if (rows.length < 2) return;
    const [head, ...body] = rows;
    out.push({
      name: ws.name,
      headers: head.map((h) => (h === null || h === undefined ? '' : String(h).trim())),
      rows: body,
    });
  });

  if (!out.length) throw new ImportReadError('No sheet in that workbook has a header row and at least one row of data.');
  return out;
}

/**
 * A CSV parser that handles quoting, embedded newlines and doubled quotes.
 *
 * Written rather than pulled in: the rules are small and well defined, and a
 * dependency here would be a third way for an import to fail. Everything stays
 * a string — CSV has no types, which is the point of preferring xlsx.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // A UTF-8 BOM would otherwise become part of the first header name.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { quoted = true; i += 1; continue; }
    if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; i += 1; continue; }
    if (c === '\r') { i += 1; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += c; i += 1;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readCsv(buf: Buffer): SheetData[] {
  const rows = parseCsv(buf.toString('utf8'))
    .map((r) => trailingBlanks(r) as string[])
    .filter((r) => !isEmptyRow(r));
  if (rows.length < 2) throw new ImportReadError('That file has a header row but no data rows.');
  const [head, ...body] = rows;
  return [{ name: 'CSV', headers: head.map((h) => h.trim()), rows: body }];
}

/**
 * Read an uploaded file into sheets. Chooses the parser by extension, falling
 * back to the magic bytes — an .xlsx renamed to .csv is a real thing people do.
 */
export async function readImportFile(filename: string, buf: Buffer): Promise<SheetData[]> {
  if (!buf?.length) throw new ImportReadError('That file is empty.');
  if (buf.length > MAX_IMPORT_BYTES) {
    throw new ImportReadError(`That file is larger than ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB.`);
  }

  const looksZipped = buf[0] === 0x50 && buf[1] === 0x4b;   // "PK" — every xlsx
  const ext = (filename.split('.').pop() ?? '').toLowerCase();

  let sheets: SheetData[];
  if (ext === 'xlsx' || ext === 'xlsm' || looksZipped) {
    sheets = await readXlsx(buf);
  } else if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    sheets = readCsv(buf);
  } else {
    throw new ImportReadError(`Locare reads .xlsx and .csv files — "${filename}" is neither.`);
  }

  for (const s of sheets) {
    if (s.rows.length > MAX_IMPORT_ROWS) {
      throw new ImportReadError(`Sheet "${s.name}" has ${s.rows.length} rows, more than the ${MAX_IMPORT_ROWS} limit.`);
    }
  }
  return sheets;
}
