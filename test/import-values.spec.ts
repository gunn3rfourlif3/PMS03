import {
  parseText, parseMoney, parseDate, parsePhone, parseEmail, parseInteger, parseBoolean, parseChoice, isBlank,
} from '../src/modules/imports/import-values';

/**
 * These are the ways an agency's spreadsheet actually breaks. Each test is a
 * real failure mode, not a shape check: a mistyped escalation date surfaces in
 * month four as a credibility problem, and the fix is a reversing ledger entry
 * rather than an edit.
 */

const val = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};
const err = (r: { ok: boolean; error?: string } | any): string => {
  if (r.ok) throw new Error('expected a failure');
  return r.error;
};

describe('money', () => {
  it('reads what South African spreadsheets contain', () => {
    expect(val(parseMoney('R 9 500'))).toBe(9500);
    expect(val(parseMoney('9,500.00'))).toBe(9500);
    expect(val(parseMoney('9 500,50'))).toBe(9500.5);      // comma decimal
    expect(val(parseMoney('1.234,56'))).toBe(1234.56);     // European style
    expect(val(parseMoney('1,234.56'))).toBe(1234.56);     // UK/US style
    expect(val(parseMoney(9500))).toBe(9500);
  });

  it('reads a credit written as a negative or in brackets', () => {
    expect(val(parseMoney('-450'))).toBe(-450);
    expect(val(parseMoney('(450)'))).toBe(-450);           // accountant's negative
  });

  it('refuses to guess at an empty cell', () => {
    // A blank rent is missing data; a rent of zero is a decision. Defaulting
    // blank to zero is how an agency ends up billing nothing.
    expect(err(parseMoney(''))).toMatch(/empty/);
    expect(err(parseMoney(null))).toMatch(/empty/);
    expect(val(parseMoney('0'))).toBe(0);
  });

  it('rejects text rather than reading part of it', () => {
    expect(err(parseMoney('call me'))).toMatch(/not an amount/);
    expect(err(parseMoney('9500 per month'))).toMatch(/not an amount/);
  });
});

describe('dates', () => {
  it('takes a real date cell from a spreadsheet', () => {
    expect(val(parseDate(new Date(Date.UTC(2026, 2, 1))))).toBe('2026-03-01');
  });

  it('converts an Excel serial number', () => {
    // What a date column looks like after a careless CSV export.
    expect(val(parseDate(46082))).toBe('2026-03-01');
  });

  it('REFUSES an ambiguous day/month pair', () => {
    // 03/04/2026 is March in one country and April in another, and a lease that
    // starts a month late is not a detectable error later.
    const e = err(parseDate('03/04/2026'));
    expect(e).toMatch(/ambiguous/);
    expect(e).toMatch(/YYYY-MM-DD/);
  });

  it('accepts an unambiguous one either way round', () => {
    expect(val(parseDate('25/12/2026'))).toBe('2026-12-25');   // day > 12
    expect(val(parseDate('12/25/2026'))).toBe('2026-12-25');   // month-first
    expect(val(parseDate('2026-03-01'))).toBe('2026-03-01');
    expect(val(parseDate('1 March 2026'))).toBe('2026-03-01');
  });

  it('rejects a date that does not exist', () => {
    expect(err(parseDate('2026-02-30'))).toMatch(/not a real date|not a date/);
    expect(err(parseDate('31/02/2026'))).toMatch(/not a real date/);
  });
});

describe('phone numbers', () => {
  it('restores the leading zero Excel eats', () => {
    // The single most common corruption: 0821234567 exported as a number.
    expect(val(parsePhone('821234567'))).toBe('+27821234567');
    expect(val(parsePhone(821234567))).toBe('+27821234567');
  });

  it('survives scientific notation', () => {
    expect(val(parsePhone('8.21234567E+08'))).toBe('+27821234567');
  });

  it('normalises the forms people actually type', () => {
    expect(val(parsePhone('0821234567'))).toBe('+27821234567');
    expect(val(parsePhone('082 123 4567'))).toBe('+27821234567');
    expect(val(parsePhone('(082) 123-4567'))).toBe('+27821234567');
    expect(val(parsePhone('+27 82 123 4567'))).toBe('+27821234567');
    expect(val(parsePhone('27821234567'))).toBe('+27821234567');
  });

  it('never invents a country code for something it cannot recognise', () => {
    expect(err(parsePhone('12345'))).toMatch(/not a phone number/);
    expect(err(parsePhone('not a number'))).toMatch(/not a phone number/);
  });
});

describe('text, integers, choices', () => {
  it('keeps a unit label as text so 007 stays 007', () => {
    expect(val(parseText('007'))).toBe('007');
    expect(val(parseText('  Grove   Court '))).toBe('Grove Court');
  });

  it('rejects a fraction where a count is expected', () => {
    expect(val(parseInteger('2'))).toBe(2);
    expect(val(parseInteger(' 12 '))).toBe(12);
    expect(err(parseInteger('2.5'))).toMatch(/whole number/);
  });

  it('reads yes and no the way people write them', () => {
    expect(val(parseBoolean('Yes'))).toBe(true);
    expect(val(parseBoolean('n'))).toBe(false);
    expect(val(parseBoolean('ja'))).toBe(true);
    expect(err(parseBoolean('maybe'))).toMatch(/yes or no/);
  });

  it('matches a choice loosely but names the options when it cannot', () => {
    expect(val(parseChoice('Month to month', ['fixed', 'month_to_month']))).toBe('month_to_month');
    expect(err(parseChoice('rolling', ['fixed', 'month_to_month']))).toMatch(/must be one of/);
  });

  it('lowercases an email', () => {
    expect(val(parseEmail(' Thandi@Example.CO.ZA '))).toBe('thandi@example.co.za');
    expect(err(parseEmail('thandi.example'))).toMatch(/not an email/);
  });

  it('knows what blank means', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isBlank('0')).toBe(false);
  });
});
