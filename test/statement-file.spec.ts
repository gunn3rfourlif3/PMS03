import * as ExcelJS from 'exceljs';
import { readStatementRows, cellText } from '../src/modules/statements/statement-file';
import { parseStatementRows } from '../src/modules/statements/statement-parse';

/**
 * The hand-off from an uploaded file to the statement parser, through the REAL
 * import reader — the seam where every CSV and Excel statement used to fail
 * with "No date column found", because the heading row was dropped before the
 * parser saw it. Figures are invented; the CSV's shape is Capitec's export.
 */

const CAPITEC_CSV = [
  'Nr,Account,Posting Date,Transaction Date,Description,Original Description,Parent Category,Category,Money In,Money Out,Fee,Balance',
  '1,1234567890,2026-10-01,2026-10-01 12:49,PayShap Payment Received: L Mokoena,L MOKOENA,Other Income,Other Income,11800.00,,,11821.91',
  '2,1234567890,2026-10-03,2026-10-03 16:04,ATM Cash Withdrawal: Shell Corner,Shell Corner ZA,Cash,Cash Withdrawal,,-100.00,,11721.91',
  '3,1234567890,2026-10-03,2026-10-03 16:04,ATM Cash Withdrawal Fee,ATM Cash Withdrawal Fee,Fees,Fees,,,-10.00,11711.91',
  '4,1234567890,2026-10-20,2026-10-20 16:11,Exc W/lim Hosting De,EXC W/LIM | HOSTING DE|MANUAL,,,,,,',
].join('\r\n');

describe('statement file -> parser hand-off', () => {
  it('keeps the heading row, so a CSV statement is read (it used to be "No date column found")', async () => {
    const rows = await readStatementRows('account_statement.csv', Buffer.from('﻿' + CAPITEC_CSV, 'utf8'));
    expect(rows[0]).toContain('Transaction Date');
    const r = parseStatementRows(rows);
    expect(r.skipped).toEqual([]);
    expect(r.mapping.date).toBe('Transaction Date');
    expect(r.lines.map((l) => [l.date, l.amount])).toEqual([
      ['2026-10-01', 11800],
      ['2026-10-03', -100],
      ['2026-10-03', -10],
    ]);
  });

  it('reads an Excel statement, with real dates and numbers in its cells', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.addRow(['Date', 'Description', 'Money In', 'Money Out', 'Fee', 'Balance']);
    ws.addRow([new Date(Date.UTC(2026, 9, 1)), 'PayShap Payment Received: L Mokoena', 11800, null, null, 11821.91]);
    ws.addRow([new Date(Date.UTC(2026, 9, 3)), 'ATM Cash Withdrawal', null, -100, -10, 11711.91]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const r = parseStatementRows(await readStatementRows('statement.xlsx', buf));
    expect(r.skipped).toEqual([]);
    expect(r.lines.map((l) => [l.date, l.amount])).toEqual([
      ['2026-10-01', 11800],
      ['2026-10-03', -100],
      ['2026-10-03', -10],
    ]);
  });

  it('writes an Excel date as its calendar day, whatever the server clock', () => {
    // Excel dates are built at UTC midnight; reading local parts would give the
    // previous day anywhere west of Greenwich.
    expect(cellText(new Date(Date.UTC(2026, 9, 1)))).toBe('2026-10-01');
    expect(cellText(null)).toBe('');
    expect(cellText(-100)).toBe('-100');
  });

  it('refuses an old .xls with the reader\'s own reason', async () => {
    await expect(readStatementRows('statement.xls', Buffer.from('not really'))).rejects.toThrow(/\.xlsx and \.csv/);
  });
});
