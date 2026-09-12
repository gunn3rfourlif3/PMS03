/**
 * Turning a spreadsheet cell into a value we can store.
 *
 * Pure, and tested hard, because this is where an import goes quietly wrong.
 * Every function here answers with either a value or a reason it could not —
 * never a silent default. A blank rent is missing data; a rent of 0 is a
 * decision. Conflating them is how an agency ends up billing nothing.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const bad = (error: string): Parsed<never> => ({ ok: false, error });

export const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Trimmed text, collapsing the double spaces that come out of merged cells. */
export function parseText(v: unknown): Parsed<string> {
  if (isBlank(v)) return bad('is empty');
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s ? ok(s) : bad('is empty');
}

/**
 * Money, as a number of rands.
 *
 * Handles what South African spreadsheets actually contain: `R 1 234,56`,
 * `1,234.56`, `1 234.56`, and negatives written as `(1234)`. The thousands
 * separator may be a space, a non-breaking space or a comma, and the decimal
 * separator may be a comma — so the LAST separator wins, which is the only rule
 * that gets both `1.234,56` and `1,234.56` right.
 */
export function parseMoney(v: unknown): Parsed<number> {
  if (isBlank(v)) return bad('is empty');
  if (typeof v === 'number') return Number.isFinite(v) ? ok(round2(v)) : bad('is not a number');

  let s = String(v).trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }

  s = s.replace(/[Rr]\s*/g, '').replace(/[\s  ]/g, '').trim();
  if (!s) return bad('is empty');
  if (!/^[\d.,]+$/.test(s)) return bad(`is not an amount: "${String(v).trim()}"`);

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);
  // A separator with exactly two digits after it is a decimal point; anything
  // else (1,234 / 1.234) is a thousands separator.
  const isDecimal = decimalAt > -1 && s.length - decimalAt - 1 <= 2 && s.length - decimalAt - 1 > 0;
  const whole = isDecimal ? s.slice(0, decimalAt).replace(/[.,]/g, '') : s.replace(/[.,]/g, '');
  const frac = isDecimal ? s.slice(decimalAt + 1) : '';
  const n = Number(`${whole || '0'}.${frac || '0'}`);
  if (!Number.isFinite(n)) return bad(`is not an amount: "${String(v).trim()}"`);
  return ok(round2(negative ? -n : n));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A date, as an ISO `YYYY-MM-DD` string.
 *
 * Excel hands us a real Date for a date-formatted cell, which is the whole
 * reason to read .xlsx rather than a CSV export. For text we accept ISO and
 * unambiguous formats, and REJECT ambiguous day/month pairs rather than
 * guessing: `03/04/2026` is March in one country and April in another, and a
 * lease that starts a month late is not a detectable error later.
 */
export function parseDate(v: unknown): Parsed<string> {
  if (isBlank(v)) return bad('is empty');
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? bad('is not a date') : ok(toIso(v));
  }
  // An Excel serial that arrived as a bare number (a CSV export of a date column).
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return bad(`is not a date: "${v}"`);
    return ok(toIso(excelSerialToDate(v)));
  }

  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return validParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), s);

  // d/m/yyyy or d-m-yyyy, including 2-digit years.
  const parts = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (parts) {
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    const year = parts[3].length === 2 ? 2000 + Number(parts[3]) : Number(parts[3]);
    if (a > 12 && b <= 12) return validParts(year, b, a, s);       // unambiguous: d/m
    if (b > 12 && a <= 12) return validParts(year, a, b, s);       // unambiguous: m/d
    if (a <= 12 && b <= 12) {
      return bad(`is ambiguous — "${s}" could be ${a}/${b} or ${b}/${a}. Use YYYY-MM-DD.`);
    }
    return bad(`is not a date: "${s}"`);
  }

  // "3 April 2026" / "3 Apr 2026"
  const named = Date.parse(s);
  if (!Number.isNaN(named) && /[A-Za-z]{3}/.test(s)) return ok(toIso(new Date(named)));
  return bad(`is not a date: "${s}"`);
}

function validParts(y: number, m: number, d: number, raw: string): Parsed<string> {
  if (m < 1 || m > 12 || d < 1 || d > 31) return bad(`is not a date: "${raw}"`);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return bad(`is not a real date: "${raw}"`);
  return ok(toIso(dt));
}

/** Excel's epoch is 1899-12-30 — 1900 is wrongly a leap year in its calendar. */
function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A South African phone number in E.164.
 *
 * The case this exists for: a CSV export turns `0821234567` into `821234567`
 * by dropping the leading zero, and sometimes into `8.21234567E+08`. A nine
 * digit number starting with 6, 7 or 8 is almost certainly a mobile that lost
 * its zero, so we restore it rather than rejecting the row — but we never
 * invent a country code for a number we cannot recognise.
 */
export function parsePhone(v: unknown): Parsed<string> {
  if (isBlank(v)) return bad('is empty');
  let s = String(v).trim();

  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }
  s = s.replace(/[\s ()\-.]/g, '');

  if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? ok(s) : bad(`is not a phone number: "${String(v).trim()}"`);
  if (/^27\d{9}$/.test(s)) return ok(`+${s}`);
  if (/^0\d{9}$/.test(s)) return ok(`+27${s.slice(1)}`);
  if (/^[678]\d{8}$/.test(s)) return ok(`+27${s}`);   // leading zero eaten by Excel
  return bad(`is not a phone number: "${String(v).trim()}"`);
}

export function parseEmail(v: unknown): Parsed<string> {
  if (isBlank(v)) return bad('is empty');
  const s = String(v).trim().toLowerCase();
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s) ? ok(s) : bad(`is not an email address: "${s}"`);
}

export function parseInteger(v: unknown): Parsed<number> {
  if (isBlank(v)) return bad('is empty');
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/[\s ,]/g, ''));
  if (!Number.isFinite(n)) return bad(`is not a whole number: "${String(v).trim()}"`);
  return Number.isInteger(n) ? ok(n) : bad(`is not a whole number: "${String(v).trim()}"`);
}

const TRUE_WORDS = ['y', 'yes', 'true', '1', 'ja'];
const FALSE_WORDS = ['n', 'no', 'false', '0', 'nee'];

export function parseBoolean(v: unknown): Parsed<boolean> {
  if (isBlank(v)) return bad('is empty');
  if (typeof v === 'boolean') return ok(v);
  const s = String(v).trim().toLowerCase();
  if (TRUE_WORDS.includes(s)) return ok(true);
  if (FALSE_WORDS.includes(s)) return ok(false);
  return bad(`is not yes or no: "${String(v).trim()}"`);
}

/** One of a fixed set, matched case- and space-insensitively. */
export function parseChoice(v: unknown, choices: readonly string[]): Parsed<string> {
  if (isBlank(v)) return bad('is empty');
  const s = String(v).trim().toLowerCase().replace(/[\s_-]+/g, '');
  const hit = choices.find((c) => c.toLowerCase().replace(/[\s_-]+/g, '') === s);
  return hit ? ok(hit) : bad(`must be one of ${choices.join(', ')} — got "${String(v).trim()}"`);
}
