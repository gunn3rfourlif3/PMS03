import * as ExcelJS from 'exceljs';
import { EntitySpec } from './import-fields';

/**
 * The downloadable template for an entity.
 *
 * Generated from the field definitions rather than maintained by hand, so a
 * template can never describe columns the importer does not read. R-5 puts
 * templates first because they are useful on their own: an agency that fills
 * one in has done the hard thinking about its own data before anyone writes
 * an importer.
 *
 * Two sheets: the data, and the instructions. The instructions are a sheet
 * rather than a row of comments because a comment row gets deleted, and then
 * the agency is guessing.
 */

/** Header row, example row, and nothing else — ready to be filled in. */
export function templateCsv(spec: EntitySpec): string {
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = spec.fields.map((f) => esc(f.label + (f.required ? ' *' : ''))).join(',');
  const example = spec.fields.map((f) => esc(f.example)).join(',');
  return `${head}\n${example}\n`;
}

export async function templateXlsx(spec: EntitySpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Locare';
  wb.created = new Date();

  // Excel forbids : \ / ? * [ ] in a sheet name and caps it at 31 characters.
  // "Arrears / opening balances" hits both.
  const sheetName = spec.label.replace(/[:\\/?*[\]]/g, '-').slice(0, 28);
  const ws = wb.addWorksheet(sheetName);
  ws.columns = spec.fields.map((f) => ({
    header: f.label + (f.required ? ' *' : ''),
    key: f.key,
    width: Math.max(14, Math.min(34, f.label.length + 6)),
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle' };
  ws.addRow(spec.fields.map((f) => f.example));

  // Text format on text columns so a unit number of 007 survives being typed
  // in, which is the single most common way a portfolio import goes wrong.
  spec.fields.forEach((f, i) => {
    const col = ws.getColumn(i + 1);
    if (f.type === 'text' || f.type === 'phone') col.numFmt = '@';
    if (f.type === 'date') col.numFmt = 'yyyy-mm-dd';
    if (f.type === 'money') col.numFmt = '#,##0.00';
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const help = wb.addWorksheet('How to fill this in');
  help.columns = [{ width: 26 }, { width: 12 }, { width: 10 }, { width: 78 }];
  help.addRow([`Locare import template — ${spec.label}`]);
  help.getRow(1).font = { bold: true, size: 14 };
  help.addRow([`One row is ${spec.rowIs}.`]);
  help.addRow([]);
  help.addRow(['Column', 'Type', 'Required', 'Notes']);
  help.getRow(4).font = { bold: true };

  for (const f of spec.fields) {
    help.addRow([
      f.label,
      f.choices ? f.choices.join(' / ') : f.type,
      f.required ? 'Yes' : 'No',
      f.note ?? '',
    ]);
  }

  help.addRow([]);
  help.addRow(['Leave a cell blank rather than typing 0, "n/a" or "unknown" — blank is understood as "no answer", and a zero is read as a real amount.']);
  help.addRow([`Rows are matched on ${spec.naturalKey.join(' + ')}, so correcting the file and uploading it again updates those rows instead of creating duplicates.`]);
  if (spec.postsToLedger) {
    help.addRow(['THIS FILE MOVES MONEY. Importing it writes entries to the accounting ledger, which cannot be edited afterwards — only reversed. The figures are shown for sign-off before anything is posted.']);
    help.getRow(help.rowCount).font = { bold: true };
  }
  help.getColumn(4).alignment = { wrapText: true, vertical: 'top' };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
