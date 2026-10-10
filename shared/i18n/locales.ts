/**
 * The locales this product ships, and nothing else.
 *
 * Shared by web-admin, mobile-tenant, mobile-landlord and (via a generated
 * snippet) the marketing site. Framework-free on purpose: this file is imported
 * by Next's server components, Next's client components and Metro, so it may
 * not reach for `next/*`, `react-native` or `window`.
 */

export const LOCALES = ['en', 'zh-Hans'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The name of each locale IN that locale — never "Chinese (Simplified)" in
 * English. Someone who cannot read the current language has to be able to find
 * their own in the switcher, which is the one place that rule matters.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-Hans': '简体中文',
};

/** Right-to-left locales. None yet; the switcher and layout read this rather
 * than assuming LTR, so adding Arabic or Hebrew later is a data change here
 * plus a `dir` attribute, not a hunt through the components. */
export const RTL_LOCALES: readonly Locale[] = [];

export const isRtl = (locale: Locale): boolean => RTL_LOCALES.includes(locale);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Coerce anything — an env var, a stored preference, a device locale, an
 * Accept-Language tag — to a locale we actually ship.
 *
 * Unknown input returns the default rather than throwing: a bad
 * DEPLOYMENT_LOCALE must not blank the app for staff who are working, which is
 * the same call `resolveDeploymentProfile` makes and for the same reason.
 *
 * Matching is case-insensitive and falls back by base language, so `zh-CN`,
 * `zh_Hans_CN` and `ZH` all land on `zh-Hans`. That is deliberate for Chinese
 * today, because Simplified is the only Chinese catalogue we ship; the moment
 * `zh-Hant` exists this function must stop collapsing every `zh` onto Hans and
 * route `zh-TW`/`zh-HK`/`zh-MO` to Hant instead.
 */
export function resolveLocale(value?: string | null): Locale {
  const raw = (value ?? '').trim().replace(/_/g, '-');
  if (!raw) return DEFAULT_LOCALE;
  const exact = LOCALES.find((l) => l.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const base = raw.split('-')[0].toLowerCase();
  const byBase = LOCALES.find((l) => l.split('-')[0].toLowerCase() === base);
  return byBase ?? DEFAULT_LOCALE;
}
