import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, Locale, MessageKey, TFunction, Vars,
  resolveLocale, translate, translatePlural,
} from '../../shared/i18n';
import * as fmt from '../../shared/i18n/format';

/**
 * The landlord app's locale layer.
 *
 * A deliberate copy of `mobile-tenant/src/i18n.tsx` — same context shape, same
 * platform work-arounds, same comments. The two apps are separate Expo
 * projects with their own node_modules and no shared source directory of their
 * own, so the alternative was a third shared package for 120 lines. If a third
 * app ever appears, that trade flips and this belongs in `shared/`.
 *
 * Mirrors `web-admin/components/locale-provider.tsx` deliberately — same
 * context shape, same `t`/`tn` and locale-bound formatters — so a screen reads
 * the same on either surface and the shared catalogue is the only source of
 * wording.
 *
 * Two things differ from web, both forced by the platform:
 *
 * 1. PERSISTENCE uses the same SecureStore/localStorage pair `src/api.ts` uses
 *    for the session token. A locale preference is not a secret and SecureStore
 *    is not really the right home for it, but the alternative is adding
 *    `@react-native-async-storage/async-storage`, and the build plan says to
 *    stop rather than add a dependency. Noted rather than hidden.
 *
 * 2. DEVICE LOCALE is read from `Intl`, not from `expo-localization` — again to
 *    avoid a new package. Expo 51 ships Hermes with Intl enabled, so
 *    `resolvedOptions().locale` is there; it is wrapped anyway, because a
 *    runtime without Intl should fall back to English rather than crash on
 *    first render.
 */

const KEY = 'pms_locale';
const isWeb = Platform.OS === 'web';

const store = {
  get: (): Promise<string | null> =>
    isWeb ? Promise.resolve(globalThis.localStorage?.getItem(KEY) ?? null) : SecureStore.getItemAsync(KEY),
  set: (v: string): Promise<void> =>
    isWeb ? Promise.resolve(globalThis.localStorage?.setItem(KEY, v)) : SecureStore.setItemAsync(KEY, v),
};

/** The device's own language, or the default when it is one we do not ship. */
function deviceLocale(): Locale {
  try {
    return resolveLocale(new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return DEFAULT_LOCALE;
  }
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
  tn: (base: string, count: number, vars?: Vars) => string;
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
  // Throws rather than defaulting to English: a screen rendering outside the
  // provider would quietly serve English forever, which is the bug this layer
  // exists to prevent and the hardest kind to notice in a demo.
  if (!ctx) throw new Error('useLocale() used outside LocaleProvider');
  return ctx;
}

export const useT = (): TFunction => useLocale().t;

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Starts on the device's language and is corrected from storage on mount.
  // There is no server render here, so unlike web this can begin with the
  // device's own choice rather than a deployment default.
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    let alive = true;
    store.get()
      .then((stored) => { if (alive && stored) setLocaleState(resolveLocale(stored)); })
      .catch(() => { /* blocked storage: the device language stands */ });
    return () => { alive = false; };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    store.set(next).catch(() => { /* works for this session, just not remembered */ });
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
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
    locales: LOCALES,
    names: LOCALE_NAMES,
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
