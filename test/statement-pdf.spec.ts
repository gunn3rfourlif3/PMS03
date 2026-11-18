import {
  readPdfStatementRows, statementDate, isPdf,
  PDF_SCANNED, PDF_UNREADABLE, PDF_NO_TABLE,
} from '../src/modules/statements/statement-pdf';
import { parseStatementRows, parseMoney, parseDate } from '../src/modules/statements/statement-parse';
import { matchStatement } from '../src/providers/payment/statement-import';

/**
 * Bank statement PDFs, read into the same lines a CSV gives.
 *
 * The fixtures are REAL PDFs, built here and read back through pdf-parse —
 * not mocked text — modelled on three layouts common in South Africa: one
 * amount column with Cr markers, separate payments/deposits columns, and money
 * in/out with a minus sign. They are modelled, not copied: a real statement
 * that defeats the reader should be added here as a case.
 */

/** `s` is the font size in points; 9 unless a layout prints smaller. */
type Item = { x: number; y: number; t: string; s?: number };

/** A minimal valid PDF: one Helvetica text object per item, one page per array. */
function buildPdf(pages: Item[][]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objs: { id: number; body: string }[] = [];
  const pageIds: number[] = [];
  let id = 4;
  for (const items of pages) {
    const content = items.map((i) => `BT /F1 ${i.s ?? 9} Tf ${i.x.toFixed(1)} ${i.y.toFixed(1)} Td (${esc(i.t)}) Tj ET`).join('\n');
    const pid = id++;
    const cid = id++;
    pageIds.push(pid);
    objs.push({ id: pid, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cid} 0 R >>` });
    objs.push({ id: cid, body: `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream` });
  }
  objs.push({ id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' });
  objs.push({ id: 2, body: `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>` });
  objs.push({ id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });
  objs.sort((a, b) => a.id - b.id);
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const o of objs) {
    offsets[o.id] = Buffer.byteLength(out, 'latin1');
    out += `${o.id} 0 obj\n${o.body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += objs.map((o) => `${String(offsets[o.id]).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

/** Right-align roughly as a bank does: Helvetica figures are ~5pt wide at 9pt. */
const right = (edge: number, t: string, y: number): Item => ({ x: edge - t.length * 5, y, t });

/** One table row: date, description, then money cells at their right edges. */
function row(y: number, date: string, desc: string, money: [number, string][]): Item[] {
  const out: Item[] = [];
  if (date) out.push({ x: 40, y, t: date });
  if (desc) out.push({ x: 95, y, t: desc });
  for (const [edge, t] of money) if (t) out.push(right(edge, t, y));
  return out;
}

const read = async (pdf: Buffer) => parseStatementRows(await readPdfStatementRows(pdf));

// --- Layout 1: one Amount column, credits marked Cr, debits bare (FNB style) ---
const AMT = 430;
const BAL = 545;
const singleColumnHeader = (y: number): Item[] => [
  { x: 40, y, t: 'Date' }, { x: 95, y, t: 'Description' }, right(AMT, 'Amount', y), right(BAL, 'Balance', y),
];
const crStatement = buildPdf([
  [
    { x: 40, y: 800, t: 'Cheque Account 62012345678' },
    { x: 40, y: 785, t: 'Statement Period : 01 November 2026 to 30 November 2026' },
    ...singleColumnHeader(740),
    ...row(722, '01 Nov', 'Opening Balance', [[BAL, '10 845.67Cr']]),
    ...row(708, '03 Nov', 'Magtape Credit LERATO MOKOENA', [[AMT, '11 800.00Cr'], [BAL, '22 645.67Cr']]),
    ...row(696, '', 'REF CARNIVAL 212 NOV RENT', []),
    ...row(682, '05 Nov', '#Monthly Account Fee', [[AMT, '250.00'], [BAL, '22 395.67Cr']]),
    ...row(668, '07 Nov', 'FNB App Payment From J PILLAY', [[AMT, '9 450.00Cr'], [BAL, '31 845.67Cr']]),
    { x: 270, y: 60, t: 'Page 1 of 2' },
  ],
  [
    ...singleColumnHeader(800),
    ...row(782, '28 Nov', 'Debit Order Insurance', [[AMT, '1 200.00'], [BAL, '30 645.67Cr']]),
    ...row(768, '30 Nov', 'Closing Balance', [[BAL, '30 645.67Cr']]),
    { x: 270, y: 60, t: 'Page 2 of 2' },
  ],
]);

describe('statement PDF: one amount column with Cr markers', () => {
  it('reads every transaction across both pages, and nothing else', async () => {
    const r = await read(crStatement);
    expect(r.skipped).toEqual([]);
    expect(r.lines.map((l) => [l.date, l.amount])).toEqual([
      ['2026-11-03', 11800],
      ['2026-11-05', -250],
      ['2026-11-07', 9450],
      ['2026-11-28', -1200],
    ]);
  });

  it('reads a bare figure as money OUT when the bank marks credits', async () => {
    const fee = (await read(crStatement)).lines.find((l) => /Account Fee/.test(l.description ?? ''));
    expect(fee?.amount).toBe(-250);
  });

  it('never takes the balance for the amount', async () => {
    const amounts = (await read(crStatement)).lines.map((l) => Math.abs(l.amount));
    for (const balance of [22645.67, 22395.67, 31845.67, 30645.67]) expect(amounts).not.toContain(balance);
  });

  it('joins a wrapped description, but not the page footer', async () => {
    const lines = (await read(crStatement)).lines;
    expect(lines[0].description).toBe('Magtape Credit LERATO MOKOENA REF CARNIVAL 212 NOV RENT');
    expect(lines.some((l) => /Page \d of/.test(l.description ?? ''))).toBe(false);
  });

  it('takes the year from the statement period', async () => {
    expect((await read(crStatement)).lines.every((l) => l.date.startsWith('2026-11-'))).toBe(true);
  });
});

// --- Layout 2: separate Payments and Deposits columns ---
describe('statement PDF: separate payments and deposits columns', () => {
  const PAY = 360, DEP = 450, BAL2 = 545;
  const pdf = buildPdf([[
    { x: 40, y: 790, t: 'Statement date 2026/11/30' },
    { x: 40, y: 740, t: 'Date' }, { x: 95, y: 740, t: 'Description' },
    right(PAY, 'Payments', 740), right(DEP, 'Deposits', 740), right(BAL2, 'Balance', 740),
    ...row(722, '2026/11/03', 'IB PAYMENT FROM L MOKOENA', [[DEP, '11,800.00'], [BAL2, '22,645.67']]),
    ...row(708, '2026/11/05', 'SERVICE FEE', [[PAY, '250.00'], [BAL2, '22,395.67']]),
  ]]);

  it('reads deposits as money in and payments as money out', async () => {
    const r = await read(pdf);
    expect(r.skipped).toEqual([]);
    expect(r.lines.map((l) => [l.date, l.amount])).toEqual([['2026-11-03', 11800], ['2026-11-05', -250]]);
  });
});

// --- Layout 3: Money In / Money Out, money out printed negative ---
describe('statement PDF: money in and money out', () => {
  const IN = 360, OUT = 450, BAL3 = 545;
  const pdf = buildPdf([[
    { x: 40, y: 740, t: 'Posting Date' }, { x: 120, y: 740, t: 'Description' },
    right(IN, 'Money In', 740), right(OUT, 'Money Out', 740), right(BAL3, 'Balance', 740),
    { x: 40, y: 722, t: '03/11/2026' }, { x: 120, y: 722, t: 'Payment Received: L Mokoena' },
    right(IN, '11 800.00', 722), right(BAL3, '22 645.67', 722),
    { x: 40, y: 708, t: '05/11/2026' }, { x: 120, y: 708, t: 'Monthly Fee' },
    right(OUT, '-250.00', 708), right(BAL3, '22 395.67', 708),
  ]]);

  it('reads both directions', async () => {
    const r = await read(pdf);
    expect(r.skipped).toEqual([]);
    expect(r.lines.map((l) => [l.date, l.amount])).toEqual([['2026-11-03', 11800], ['2026-11-05', -250]]);
  });
});

// --- Layout 4: GoTyme style. Modelled on a real statement's LAYOUT; every
// name and figure here is invented. A Fees column of its own, "-" in empty
// cells, a summary box of balances above the table, and descriptions that wrap
// ABOVE and below a vertically centred date and amount.
describe('statement PDF: fees column and descriptions centred on the date', () => {
  // GoTyme prints at about 5pt; positions are the real layout's, figures invented.
  const g = (x: number, y: number, t: string): Item => ({ x, y, t, s: 5 });
  const at = (edge: number, t: string, y: number): Item => g(edge - t.length * 2.8, y, t);
  const FEE = 271, CR = 314, DR = 356, RB = 412;
  const money = (y: number, fee: string, cr: string, dr: string, bal: string): Item[] =>
    [at(FEE, fee, y), at(CR, cr, y), at(DR, dr, y), at(RB, bal, y)];
  const pdf = buildPdf([[
    g(213, 492.8, 'Opening balance'), g(395, 492.8, 'R500.00'),
    g(213, 483.1, 'Total Credit'), g(398, 483.1, 'R11,800'),
    g(18, 437.7, 'Period: 19 Oct 2026 - 17 Nov 2026'),
    g(27, 409, 'Date'), g(79, 409, 'Details'), g(254, 409, 'Fees*(-)'),
    g(291, 409, 'Credits(+)'), g(336, 409, 'Debits(-)'), g(377, 409, 'RunningBalance'),
    // A fee whose description wraps above and below its date.
    g(79, 391.4, 'Fee: Unsuccessful Online Purchase from SHOP'),
    g(27, 387.4, '20 Oct 2026'), ...money(387.4, '3', '-', '-', '497.00'),
    g(79, 383.5, 'Cape Town ZA 1234 - insufficient funds'),
    // A tenant's payment on one line.
    g(27, 367.8, '21 Oct 2026'), g(79, 367.8, 'EFT from L MOKOENA RENT'),
    ...money(367.8, '-', '11,800', '-', '12,297.00'),
    // A payment out whose description wraps above and below.
    g(79, 352, 'Payment to J SMITH Standard Bank,'),
    g(27, 348, '21 Oct 2026'), ...money(348, '-', '-', '1,200', '11,097.00'),
    g(79, 344, 'VENTER'),
    g(27, 332, '21 Oct 2026'), g(79, 332, 'Fee: SMS Notification'),
    ...money(332, '0.50', '-', '-', '11,096.50'),
    g(27, 128.5, '*All bank fees are inclusive of VAT at 15%.'),
    g(386, 104.9, 'Page 1 of 1'),
  ]]);

  it('reads fees as money out instead of reporting them unreadable', async () => {
    const r = await read(pdf);
    expect(r.skipped).toEqual([]);
    expect(r.mapping.fee).toBe('Fees*(-)');
    expect(r.lines.map((l) => l.amount)).toEqual([-3, 11800, -1200, -0.5]);
  });

  it('puts each wrapped line on its own transaction, top to bottom', async () => {
    const d = (await read(pdf)).lines.map((l) => l.description);
    expect(d[0]).toBe('Fee: Unsuccessful Online Purchase from SHOP Cape Town ZA 1234 - insufficient funds');
    expect(d[1]).toBe('EFT from L MOKOENA RENT');
    expect(d[2]).toBe('Payment to J SMITH Standard Bank, VENTER');
    expect(d[3]).toBe('Fee: SMS Notification');
  });

  it('ignores the summary box of balances above the table', async () => {
    expect((await read(pdf)).lines.map((l) => Math.abs(l.amount))).not.toContain(500);
  });
});

describe('statement PDF: a statement that spans the new year', () => {
  const pdf = buildPdf([[
    { x: 40, y: 785, t: 'Statement Period : 15 December 2026 to 14 January 2027' },
    ...singleColumnHeader(740),
    ...row(722, '28 Dec', 'Credit A TENANT', [[AMT, '8 000.00Cr'], [BAL, '18 000.00Cr']]),
    ...row(708, '03 Jan', 'Credit B TENANT', [[AMT, '9 000.00Cr'], [BAL, '27 000.00Cr']]),
  ]]);

  it('puts December in the old year and January in the new', async () => {
    expect((await read(pdf)).lines.map((l) => l.date)).toEqual(['2026-12-28', '2027-01-03']);
  });
});

describe('statement PDF: what it refuses', () => {
  it('says a scan is a scan', async () => {
    await expect(readPdfStatementRows(buildPdf([[]]))).rejects.toThrow(PDF_SCANNED);
  });

  it('says a broken file is unreadable', async () => {
    await expect(readPdfStatementRows(Buffer.from('%PDF-1.4 this is not really a pdf'))).rejects.toThrow(PDF_UNREADABLE);
  });

  it('says when there is no transactions table, rather than guessing one', async () => {
    const letter = buildPdf([[{ x: 40, y: 760, t: 'Dear customer, your statement is attached.' }]]);
    await expect(readPdfStatementRows(letter)).rejects.toThrow(PDF_NO_TABLE);
  });

  it('reports a line with money but no readable date, instead of dropping it', async () => {
    const pdf = buildPdf([[
      { x: 40, y: 785, t: 'Statement Period : 01 November 2026 to 30 November 2026' },
      ...singleColumnHeader(740),
      ...row(722, '03 Nov', 'Credit A', [[AMT, '1 000.00Cr']]),
      ...row(708, '', 'Credit with no date', [[AMT, '2 000.00Cr']]),
    ]]);
    const r = await read(pdf);
    expect(r.lines).toHaveLength(1);
    expect(r.skipped).toMatchObject([{ row: 3, reason: 'Unreadable date' }]);
    // The screen shows what the line said; a row number means nothing on a PDF.
    expect(r.skipped[0].text).toContain('Credit with no date');
  });

  it('will not invent a year for "15 Nov" when the statement gives none', () => {
    expect(statementDate('15 Nov', null)).toBeNull();
  });
});

describe('statement PDF through to invoice matching', () => {
  it('matches tenants\' payments and refuses to match the bank fee to a R250 invoice', async () => {
    const { lines } = await read(crStatement);
    const result = matchStatement(lines, [
      { id: 'lerato', outstanding: 11800, dueDate: '2026-11-01' },
      { id: 'jason', outstanding: 9450, dueDate: '2026-11-01' },
      { id: 'parking', outstanding: 250, dueDate: '2026-11-01' },
    ]);
    expect(result.matched.map((m) => [m.invoice.id, m.amount]).sort()).toEqual([['jason', 9450], ['lerato', 11800]]);
    // The fee is money OUT: read as a credit it would have "paid" the parking invoice.
    expect(result.unmatched.find((u) => u.line.amount === -250)?.reason).toBe('not_a_credit');
  });
});

describe('figures and dates as statements print them', () => {
  it('reads Cr and Dr markers and a trailing minus', () => {
    expect(parseMoney('1 500.00Cr')).toBe(1500);
    expect(parseMoney('250.00 Dr')).toBe(-250);
    expect(parseMoney('1,500.00-')).toBe(-1500);
    expect(parseMoney('R 8 500.00')).toBe(8500); // the R strip still works beside markers
    expect(parseMoney('Cr')).toBeNull();
  });

  it('reads month names and year-first dates', () => {
    expect(parseDate('15 Nov 2026')).toBe('2026-11-15');
    expect(parseDate('3-Nov-26')).toBe('2026-11-03');
    expect(parseDate('3 November 2026')).toBe('2026-11-03');
    expect(parseDate('2026/11/03')).toBe('2026-11-03');
    expect(parseDate('31 Nov 2026')).toBeNull();
  });

  it('applies the bare-figure rule to a CSV too', () => {
    const r = parseStatementRows([
      ['Date', 'Description', 'Amount', 'Balance'],
      ['03/11/2026', 'Credit', '11 800.00Cr', '22 645.67Cr'],
      ['05/11/2026', 'Fee', '250.00', '22 395.67Cr'],
    ]);
    expect(r.lines.map((l) => l.amount)).toEqual([11800, -250]);
  });

  it('does not mistake a "Payments reference" column for money out', () => {
    const r = parseStatementRows([
      ['Date', 'Payments reference', 'Credit'],
      ['03/11/2026', 'ABC', '100.00'],
    ]);
    expect(r.mapping.debit).toBeUndefined();
  });

  it('knows a PDF by name or by its first bytes', () => {
    expect(isPdf('statement.PDF', Buffer.from('x'))).toBe(true);
    expect(isPdf('download', Buffer.from('%PDF-1.7 ...'))).toBe(true);
    expect(isPdf('statement.csv', Buffer.from('Date,Amount'))).toBe(false);
  });
});
