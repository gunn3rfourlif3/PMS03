import * as ExcelJS from 'exceljs';
import { readImportFile, parseCsv, ImportReadError } from '../src/modules/imports/import-reader';
import { suggestMapping, suggestField, entitySpec } from '../src/modules/imports/import-fields';

async function workbook(rows: unknown[][], sheetName = 'Sheet1'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('reading a workbook', () => {
  it('keeps cell types, which is the whole reason to prefer xlsx', async () => {
    const buf = await workbook([
      ['Unit', 'Rent', 'Start'],
      ['007', 9500, new Date(Date.UTC(2026, 2, 1))],
    ]);
    const [sheet] = await readImportFile('portfolio.xlsx', buf);
    expect(sheet.headers).toEqual(['Unit', 'Rent', 'Start']);
    expect(sheet.rows[0][0]).toBe('007');            // text stays text
    expect(sheet.rows[0][1]).toBe(9500);             // number stays a number
    expect(sheet.rows[0][2]).toBeInstanceOf(Date);   // and a date is a Date
  });

  it('reads an xlsx that was renamed to .csv', async () => {
    // People do this. Magic bytes decide, not the extension.
    const buf = await workbook([['Unit', 'Rent'], ['007', 9500]]);
    const [sheet] = await readImportFile('portfolio.csv', buf);
    expect(sheet.rows[0][0]).toBe('007');
  });

  it('skips sheets with no data rather than offering an empty one', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Notes').addRow(['just a header']);
    const ws = wb.addWorksheet('Units');
    ws.addRow(['Unit', 'Rent']);
    ws.addRow(['007', 9500]);
    const sheets = await readImportFile('x.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
    expect(sheets.map((s) => s.name)).toEqual(['Units']);
  });

  it('refuses a file it cannot read, by name', async () => {
    await expect(readImportFile('portfolio.pdf', Buffer.from('x'))).rejects.toThrow(ImportReadError);
    await expect(readImportFile('empty.csv', Buffer.alloc(0))).rejects.toThrow(/empty/);
  });
});

describe('csv parsing', () => {
  it('handles quotes, embedded commas and doubled quotes', () => {
    const rows = parseCsv('name,note\n"Grove Court, Block A","He said ""yes"""\n');
    expect(rows[1]).toEqual(['Grove Court, Block A', 'He said "yes"']);
  });

  it('handles an embedded newline inside a quoted field', () => {
    expect(parseCsv('a,b\n"line one\nline two",2\n')[1]).toEqual(['line one\nline two', '2']);
  });

  it('strips a UTF-8 BOM so the first header is not corrupted', () => {
    expect(parseCsv('﻿Unit,Rent\n007,9500\n')[0][0]).toBe('Unit');
  });

  it('accepts semicolons and tabs, which Excel emits by locale', () => {
    expect(parseCsv('a;b\n1;2\n')[1]).toEqual(['1', '2']);
    expect(parseCsv('a\tb\n1\t2\n')[1]).toEqual(['1', '2']);
  });
});

describe('column mapping suggestions', () => {
  const leases = entitySpec('leases');

  it('matches the names agencies actually use', () => {
    expect(suggestField('Monthly Rent', leases)).toBe('rentAmount');
    expect(suggestField('Commencement Date', leases)).toBe('startDate');
    expect(suggestField('Unit No.', leases)).toBe('unitLabel');
    expect(suggestField('Building', leases)).toBe('propertyName');
  });

  it('leaves a column it does not recognise unmapped', () => {
    // A wrong automatic mapping is worse than a gap: the operator scans for
    // gaps and trusts whatever is already filled in.
    expect(suggestField('Notes from Jenny', leases)).toBeNull();
    expect(suggestField('', leases)).toBeNull();
  });

  it('never assigns one field to two columns', () => {
    const map = suggestMapping(['Rent', 'Monthly Rent', 'Unit'], leases);
    const assigned = Object.values(map);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(map[0]).toBe('rentAmount');   // first wins
    expect(map[1]).toBeUndefined();
  });

  it('suggests a whole realistic header row', () => {
    const map = suggestMapping(
      ['Building', 'Unit No.', 'Tenant', 'Commencement', 'Expiry', 'Rental', 'Escalation %'],
      leases,
    );
    expect(Object.values(map)).toEqual(
      ['propertyName', 'unitLabel', 'tenantName', 'startDate', 'endDate', 'rentAmount', 'escalationPct'],
    );
  });
});
