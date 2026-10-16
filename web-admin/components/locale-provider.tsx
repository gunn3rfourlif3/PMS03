'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE, LOCALE_NAMES, Locale, MessageKey, TFunction, Vars,
  isRtl, resolveLocale, translate, translatePlural,
} from '@shared/i18n';
import * as fmt from '@shared/i18n/format';

const STORAGE_KEY = 'pms.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
  /** Counted strings: `tn('dashboard.arrears', n)` picks the locale's own
   * plural form and passes `{count}` for free. */
  tn: (base: string, count: number, vars?: Vars) => string;
  /** Locale-bound formatters, so a caller never has to remember to pass the
   * locale and so no component can format against the wrong one. */
  money: (amount: number | null | undefined) => string;
  number: (value: number | null | undefined, maxFractionDigits?: number) => string;
  percent: (fraction: number | null | undefined, digits?: number) => string;
  date: (value: Date | string | number | null | undefined) => string;
  dateTime: (value: Date | string | number | null | undefined) => string;
  monthLabel: (value: Date | string | number | null | undefined) => string;
  locales: readonly Locale[];
  names: Record<Locale, string>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  // A hard throw rather than a silent default: a component rendering outside
  // the provider would quietly serve English forever, which is exactly the bug
  // this layer exists to prevent and the hardest kind to notice in a demo.
  if (!ctx) throw new Error('useLocale() used outside LocaleProvider');
  return ctx;
}

/** Shorthand for the common case. */
export const useT = (): TFunction => useLocale().t;

/**
 * `initial` is resolved on the server from DEPLOYMENT_LOCALE (then the request
 * host), exactly as BrandProvider resolves the brand, so the first HTML already
 * carries the right language — no flash of English before a Mandarin demo
 * settles, and nothing wrong baked into a cached render.
 *
 * The stored preference wins on mount, because a person who switched the
 * language meant it. That read is deliberately NOT done during render: the
 * server has no localStorage, and reading it in render is how you get a
 * hydration mismatch that React resolves by silently keeping the server's
 * value.
 */
export default function LocaleProvider({
  initial,
  locales,
  children,
}: {
  initial?: Locale;
  /** The locales this DEPLOYMENT may serve, from `enabledLocales()` on the
   * server. Not the catalogue list: a catalogue being in the build is not
   * permission to show it. Omitted means English only, so a caller that
   * forgets the prop under-serves rather than leaking a locale. */
  locales?: readonly Locale[];
  children: React.ReactNode;
}) {
  const serverLocale = initial ?? DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState<Locale>(serverLocale);
  const allowed = useMemo<readonly Locale[]>(
    () => (locales && locales.length ? locales : [DEFAULT_LOCALE]),
    [locales],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const resolved = resolveLocale(stored);
      // Checked against the deployment's enabled set, not merely against the
      // catalogue: localStorage is per-origin, so a browser that stored
      // `zh-Hans` during a demo must not keep Mandarin if that origin later
      // serves the live deployment.
      if (allowed.includes(resolved) && resolved !== locale) setLocaleState(resolved);
      // There is deliberately NO fall-through to `navigator.language`. It used
      // to be here, and it meant any visitor with a Chinese browser locale got
      // the demo catalogue on the live site without touching anything --
      // `resolveLocale` collapses every `zh*` tag onto zh-Hans, so zh-TW and
      // zh-HK landed there too. A locale is now served only when the
      // deployment names it or the viewer picks it from the switcher.
    } catch {
      // Private mode, blocked storage: the server-resolved locale stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `lang` and `dir` are set here rather than in the root layout because the
  // locale can change after hydration, and a document that says lang="en" while
  // showing Chinese breaks screen readers and the browser's own font picking.
  useEffect(() => {
    try {
      const html = document.documentElement;
      html.lang = locale;
      html.dir = isRtl(locale) ? 'rtl' : 'ltr';
    } catch {
      /* no document: nothing to annotate */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    // A locale the deployment does not serve cannot be set, however the call
    // arrives -- the switcher only offers `allowed`, but this is the invariant.
    if (!allowed.includes(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The switch still works for this session; it just will not be remembered.
    }
  }, [allowed]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
      tn: (base: string, count: number, vars?: Vars) => translatePlural(locale, base, count, vars),
      money: (a) => fmt.money(locale, a),
      number: (v, d) => fmt.number(locale, v, d),
      percent: (v, d) => fmt.percent(locale, v, d),
      date: (v) => fmt.date(locale, v),
      dateTime: (v) => fmt.dateTime(locale, v),
      monthLabel: (v) => fmt.monthLabel(locale, v),
      locales: allowed,
      names: LOCALE_NAMES,
    }),
    [locale, setLocale, allowed],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
