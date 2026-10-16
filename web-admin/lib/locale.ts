/**
 * Server-side locale resolution for the root layout.
 *
 * Mirrors how the brand is resolved: a value derived from the request before
 * any HTML is sent, so the first paint is already in the right language. The
 * client provider can still override it from a stored preference — see
 * `components/locale-provider.tsx`.
 */

import { DEFAULT_LOCALE, Locale, enabledLocales, isLocale, resolveLocale } from '@shared/i18n';

/**
 * Order: the deployment's own setting, then the host.
 *
 * `DEPLOYMENT_LOCALE` is what makes a client demo boot in that client's
 * language — one env var on the demo container, no code change, which is the
 * requirement this whole plan exists to serve.
 *
 * The host rule is narrow on purpose: ONLY a leading subdomain that is itself a
 * locale we ship (`zh-hans.demo.example.com`, `zh.demo.example.com`). It does
 * NOT guess a language from a country domain — `.co.za` is not a language, and
 * an agency on a `.cn` domain may well work in English. Guessing there would
 * put staff into a language they did not choose.
 */
export function resolveRequestLocale(host: string | null | undefined, envValue?: string | null): Locale {
  const fromEnv = (envValue ?? '').trim();
  if (fromEnv) return resolveLocale(fromEnv);

  // Gated on `enabledLocales`, which makes the host rule below unreachable
  // today -- deliberately. With DEPLOYMENT_LOCALE set we have already returned;
  // with it unset the enabled set is English alone, so `zh-hans.` pointed at a
  // production host resolves to English rather than serving a locale nobody
  // turned on. The parsing is kept rather than deleted because serving a demo
  // on a locale subdomain of the live container is still an option; taking it
  // means adding a separate "which locales may this deployment serve" variable,
  // since one variable cannot both name the boot locale and allow a second one
  // chosen by host.
  const enabled = enabledLocales(envValue);
  if (enabled.length < 2) return DEFAULT_LOCALE;

  const first = (host ?? '').trim().toLowerCase().split(':')[0].split('.')[0];
  if (!first) return DEFAULT_LOCALE;
  const candidate = resolveLocale(first);
  if (!enabled.includes(candidate)) return DEFAULT_LOCALE;
  // `resolveLocale` falls back to the default for anything unknown, so this
  // check is what stops `app.locare.co.za` being read as a locale request.
  if (candidate !== DEFAULT_LOCALE || isLocale(first)) return candidate;
  return DEFAULT_LOCALE;
}
