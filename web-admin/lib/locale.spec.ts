/**
 * The locale gate.
 *
 * These cases exist because a non-English catalogue in the build is not
 * permission to serve it. The Mandarin catalogue was written for one client
 * demo, and the rule is that it appears only where a deployment asks for it by
 * name. Everything below is that rule, stated as behaviour.
 */
import { DEFAULT_LOCALE, enabledLocales, isLocaleEnabled } from '@shared/i18n';
import { resolveRequestLocale } from '@/lib/locale';

describe('enabledLocales', () => {
  it('serves English alone when DEPLOYMENT_LOCALE is unset — the production case', () => {
    expect(enabledLocales(undefined)).toEqual(['en']);
    expect(enabledLocales(null)).toEqual(['en']);
    expect(enabledLocales('')).toEqual(['en']);
    expect(enabledLocales('   ')).toEqual(['en']);
  });

  it('adds the deployment locale when one is named', () => {
    expect(enabledLocales('zh-Hans')).toEqual(['en', 'zh-Hans']);
    // Same coercion the rest of the stack uses, so a demo container set to
    // `zh-CN` or `zh_Hans_CN` is not silently English-only.
    expect(enabledLocales('zh-CN')).toEqual(['en', 'zh-Hans']);
    expect(enabledLocales('ZH')).toEqual(['en', 'zh-Hans']);
  });

  it('degrades an unknown or malformed value to English-only, never to empty', () => {
    expect(enabledLocales('kl-Nonsense')).toEqual(['en']);
    expect(enabledLocales('en')).toEqual(['en']);
    expect(enabledLocales('zh-Hans').length).toBeGreaterThan(0);
  });

  it('answers isLocaleEnabled per deployment', () => {
    expect(isLocaleEnabled('zh-Hans', undefined)).toBe(false);
    expect(isLocaleEnabled('zh-Hans', 'zh-Hans')).toBe(true);
    expect(isLocaleEnabled('en', undefined)).toBe(true);
  });
});

describe('resolveRequestLocale', () => {
  it('boots the deployment locale when the container names one', () => {
    expect(resolveRequestLocale('demo.locare.co.za', 'zh-Hans')).toBe('zh-Hans');
    expect(resolveRequestLocale('demo.locare.co.za', 'zh-CN')).toBe('zh-Hans');
  });

  it('is English on a production host with no DEPLOYMENT_LOCALE', () => {
    expect(resolveRequestLocale('app.locare.co.za', undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveRequestLocale('locare.co.za', '')).toBe(DEFAULT_LOCALE);
  });

  it('ignores a locale subdomain on a deployment that enabled nothing', () => {
    // The guarantee that matters: pointing `zh-hans.` at the live container
    // does not serve Mandarin. Enabling a locale is a deployment decision, not
    // a DNS one.
    expect(resolveRequestLocale('zh-hans.locare.co.za', undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveRequestLocale('zh.locare.co.za', undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveRequestLocale('zh-hans.app.locare.co.za', '')).toBe(DEFAULT_LOCALE);
  });

  it('never reads a language out of a country domain', () => {
    expect(resolveRequestLocale('agency.cn', undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveRequestLocale('app.locare.co.za', undefined)).toBe(DEFAULT_LOCALE);
  });

  it('is English for a missing or empty host', () => {
    expect(resolveRequestLocale(null, undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveRequestLocale('', undefined)).toBe(DEFAULT_LOCALE);
  });
});
