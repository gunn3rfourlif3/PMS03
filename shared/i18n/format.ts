/**
 * Money, dates and numbers are FORMATTED against the locale, never translated.
 *
 * The rule that matters, from the plan's standing constraints: **ZAR stays
 * ZAR.** Switching the interface to Simplified Chinese changes digit grouping
 * and date order; it does not convert a rand into a renminbi. No function here
 * may take an exchange rate, and none may be given one later — a demo that
 * silently restates an agency's balance in another currency is worse than a
 * demo in the wrong language.
 */

import { Locale } from './locales';

/** The platform's one currency. Not a parameter, deliberately. */
export const CURRENCY = 'ZAR';

const zero = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * R 12 345,67 in English; the same amount, grouped per the locale, in Chinese.
 *
 * `Intl` is in every runtime this ships to (modern browsers, and Hermes with
 * `Intl` enabled, which Expo 51 has on by default). It is still wrapped,
 * because a formatter throwing inside a table row should not blank the page —
 * a plain rand string is a fine worst case.
 */
export function money(locale: Locale, amount: number | null | undefined): string {
  const value = zero(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `R ${value.toFixed(2)}`;
  }
}

export function number(locale: Locale, value: number | null | undefined, maxFractionDigits = 2): string {
  const n = zero(value);
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n);
  } catch {
    return String(n);
  }
}

export function percent(locale: Locale, fraction: number | null | undefined, digits = 1): string {
  const n = zero(fraction);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${(n * 100).toFixed(digits)}%`;
  }
}

const asDate = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * An unparseable or absent date returns an empty string, not "Invalid Date" and
 * not today. A blank cell says "we do not have this"; a date we invented says
 * something false about a lease.
 */
export function date(locale: Locale, value: Date | string | number | null | undefined): string {
  const d = asDate(value);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function dateTime(locale: Locale, value: Date | string | number | null | undefined): string {
  const d = asDate(value);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** "October 2026" / "2026年10月" — the period label utilities and statements use. */
export function monthLabel(locale: Locale, value: Date | string | number | null | undefined): string {
  const d = asDate(value);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
  } catch {
    return d.toISOString().slice(0, 7);
  }
}
