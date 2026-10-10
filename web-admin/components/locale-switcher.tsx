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
    <label className="mx-1 flex items-center gap-2 rounded-xl px-2 py-2 text-white/60 transition hover:bg-white/10 hover:text-white">
      <Languages size={18} className="shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">{t('locale.change')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        aria-label={t('locale.label')}
        className="w-full cursor-pointer bg-transparent text-sm font-medium text-current outline-none"
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
