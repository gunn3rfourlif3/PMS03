/**
 * An uploaded statement file -> rows for `parseStatementRows`, heading row first.
 *
 * THE BUG THIS EXISTS TO KILL. The bank-statement screen passed the parser
 * `readImportFile(...)[0].rows` — but the import reader splits the heading row
 * off into `headers` and returns only the rows BELOW it. So the parser took the
 * first transaction for the heading, found no date column, and every CSV and
 * Excel statement failed with "No date column found". Each side was tested on
 * its own and both were right; nothing tested the hand-off, which is where it
 * broke. test/statement-file.spec.ts now does, through the real reader.
 *
 * The second half of the hand-off: Excel cells arrive in their spreadsheet type
 * — a real Date, a number, null — and the parser reads text. A Date is written
 * as its calendar day. Excel dates carry no time zone and the reader builds them
 * at UTC midnight, so the UTC parts ARE the day; local parts would be the day
 * before anywhere west of Greenwich.
 */
import { readImportFile } from '@modules/imports/import-reader';
import { isPdf, readPdfStatementRows } from './statement-pdf';

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  return String(v);
}

export async function readStatementRows(filename: string, buf: Buffer): Promise<string[][]> {
  if (isPdf(filename, buf)) return readPdfStatementRows(buf);
  const sheet = (await readImportFile(filename, buf))?.[0];
  if (!sheet) return [];
  return [sheet.headers, ...sheet.rows].map((row) => Array.from(row ?? [], cellText));
}
