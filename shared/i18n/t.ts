/**
 * The whole translation mechanism.
 *
 * No i18n library, per the plan's standing constraints: `next-intl` serves
 * neither Expo app and the marketing site has no build step, and three
 * libraries across four surfaces is worse than one file. Same reasoning that
 * kept a markdown dependency out of the partner manual route.
 */

import { DEFAULT_LOCALE, Locale } from './locales';
import { en } from './en';
import { zhHans } from './zh-Hans';

/** The English catalogue is the shape every other locale is checked against. */
export type Messages = typeof en;
export type MessageKey = keyof Messages;

/** A translation may be partial while it is being written. A missing key is not
 * an error — it renders English. */
export type Catalogue = Partial<Record<MessageKey, string>>;

export type Vars = Record<string, string | number>;

const CATALOGUES: Record<Locale, Catalogue> = {
  en,
  // Empty until Day 9, and that is correct rather than broken: every string
  // renders English via the fallback below, which is a readable app rather
  // than a screen of key names.
  'zh-Hans': zhHans,
};

/** `Hello {name}` + `{ name: 'Thandi' }` → `Hello Thandi`. A var with no
 * matching key is left as written rather than blanked, so a typo shows up as
 * `{nmae}` on screen instead of vanishing silently. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * Look a key up in `locale`, then in English, then give back the key itself.
 *
 * English is the source of truth, so falling through to it is the designed
 * behaviour and not a degraded mode — an untranslated button reads in English
 * and still works. Returning the key is the last resort and only happens when
 * a key is referenced that `en.ts` does not define, which Day 9's verification
 * is there to catch.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const hit = CATALOGUES[locale]?.[key];
  if (hit) return interpolate(hit, vars);
  const fallback = CATALOGUES[DEFAULT_LOCALE]?.[key];
  if (fallback) return interpolate(fallback, vars);
  return String(key);
}

/** Bind a locale once and hand the result to a component tree. */
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export const translatorFor =
  (locale: Locale): TFunction =>
  (key, vars) =>
    translate(locale, key, vars);

/** Day 9's verification calls this: every key `en` defines, present and
 * non-empty in the target. Exported from here rather than written in the spec
 * so the check and the lookup cannot disagree about what "missing" means. */
export function missingKeys(locale: Locale): MessageKey[] {
  const target = CATALOGUES[locale] ?? {};
  return (Object.keys(en) as MessageKey[]).filter((k) => !target[k]);
}

/**
 * Plural selection via `Intl.PluralRules`.
 *
 * Added on Day 3, when the dashboard's "{n} tenant / {n} tenants" showed that
 * the Day 1 core could not express a count without inventing a string.
 *
 * The caller passes a BASE key and the count; this picks `<base>.one`,
 * `<base>.other` and so on from the locale's own plural categories, falling
 * back to `<base>.other`. English uses two; Chinese uses only `other`, which is
 * why a translator must not be handed an English "one" form and asked to make
 * it fit — each locale declares the forms it needs by which keys it defines.
 *
 * `count` is passed through as `{count}` so the template never has to repeat it.
 */
export function translatePlural(locale: Locale, base: string, count: number, vars?: Vars): string {
  let category = 'other';
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    // No Intl.PluralRules: `other` is the safe form, and English's `other` is
    // the plural, which is wrong only for exactly one item.
  }
  const withCount: Vars = { count, ...vars };
  const key = `${base}.${category}` as MessageKey;
  const direct = CATALOGUES[locale]?.[key] ?? CATALOGUES[DEFAULT_LOCALE]?.[key];
  if (direct) return interpolate(direct, withCount);
  return translate(locale, `${base}.other` as MessageKey, withCount);
}
