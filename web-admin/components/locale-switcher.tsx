'use client';
import { Languages } from 'lucide-react';
import { useLocale } from './locale-provider';

/**
 * The switcher, as it appears in the dark sidebar.
 *
 * A native `<select>` rather than a custom dropdown: it is one control, it is
 * keyboard- and screen-reader-correct for free, and on a phone it opens the
 * platform picker. A hand-rolled menu here would need the same focus work the
 * assistant panel needed and buy nothing.
 *
 * Option labels come from `LOCALE_NAMES`, which names each locale IN that
 * locale — someone who cannot read the current language still finds their own.
 */
export default function LocaleSwitcher() {
  const { locale, setLocale, locales, names, t } = useLocale();
  // One shipped locale means nothing to choose between, and a disabled select
  // saying "English" is clutter. It appears the moment a second lands.
  if (locales.length < 2) return null;
  return (
    // Bordered and full-contrast rather than a dim text row: on a demo where
    // switching language is the thing being shown, a control nobody can find
    // is a feature nobody sees.
    <label className="mx-1 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-white transition hover:border-white/35 hover:bg-white/15 focus-within:ring-2 focus-within:ring-white/50">
      <Languages size={18} className="shrink-0" aria-hidden />
      <span className="sr-only">{t('locale.change')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        aria-label={t('locale.label')}
        className="w-full cursor-pointer bg-transparent text-sm font-semibold text-current outline-none"
      >
        {locales.map((l) => (
          // Dark sidebar: the closed select inherits white, but the open option
          // list is painted by the OS, so each option needs its own colours or
          // it renders white-on-white on most platforms.
          <option key={l} value={l} className="bg-white text-ink">
            {names[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
