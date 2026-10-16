/**
 * The client half of the locale gate: what a browser can reach.
 *
 * The server decides which locales a deployment serves; these cases prove the
 * browser cannot talk its way past that decision — not with a stored
 * preference left over from a demo, not with its own language setting, not by
 * calling setLocale directly.
 */
import { render, screen, act } from '@testing-library/react';
import LocaleProvider, { useLocale } from '@/components/locale-provider';
import LocaleSwitcher from '@/components/locale-switcher';

const STORAGE_KEY = 'pms.locale';

function Probe() {
  const { locale, locales, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="count">{locales.length}</span>
      <button onClick={() => setLocale('zh-Hans')}>force zh</button>
    </div>
  );
}

const setNavigatorLanguage = (value: string) =>
  Object.defineProperty(window.navigator, 'language', { value, configurable: true });

beforeEach(() => {
  window.localStorage.clear();
  setNavigatorLanguage('en-ZA');
});

describe('the switcher', () => {
  it('does not render on a deployment serving one locale', () => {
    render(
      <LocaleProvider initial="en" locales={['en']}>
        <LocaleSwitcher />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('does not render when the prop is omitted — forgetting it under-serves, never leaks', () => {
    render(
      <LocaleProvider initial="en">
        <LocaleSwitcher />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('renders both locales on a deployment that enabled a second', () => {
    render(
      <LocaleProvider initial="zh-Hans" locales={['en', 'zh-Hans']}>
        <LocaleSwitcher />
      </LocaleProvider>,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['en', 'zh-Hans']);
  });
});

describe('a stored preference', () => {
  it('is ignored when the deployment does not serve it', () => {
    // The leak this closes: localStorage is per-origin, so a browser used for
    // the demo must not carry Mandarin back to a live deployment on that origin.
    window.localStorage.setItem(STORAGE_KEY, 'zh-Hans');
    render(
      <LocaleProvider initial="en" locales={['en']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('is honoured when the deployment does serve it', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-Hans');
    render(
      <LocaleProvider initial="en" locales={['en', 'zh-Hans']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('zh-Hans');
  });
});

describe("the browser's own language", () => {
  it('does not select a locale, even one the deployment serves', () => {
    // There is no navigator.language fallback by design: it meant any visitor
    // with a Chinese browser locale got the demo catalogue without asking.
    setNavigatorLanguage('zh-CN');
    render(
      <LocaleProvider initial="en" locales={['en', 'zh-Hans']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('does not select a locale on a production deployment either', () => {
    setNavigatorLanguage('zh-TW');
    render(
      <LocaleProvider initial="en" locales={['en']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });
});

describe('setLocale', () => {
  it('refuses a locale the deployment does not serve', () => {
    render(
      <LocaleProvider initial="en" locales={['en']}>
        <Probe />
      </LocaleProvider>,
    );
    act(() => screen.getByText('force zh').click());
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('accepts one the deployment serves, and remembers it', () => {
    render(
      <LocaleProvider initial="en" locales={['en', 'zh-Hans']}>
        <Probe />
      </LocaleProvider>,
    );
    act(() => screen.getByText('force zh').click());
    expect(screen.getByTestId('locale').textContent).toBe('zh-Hans');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('zh-Hans');
  });
});

describe('the context', () => {
  it('reports the deployment set, not the catalogue list', () => {
    render(
      <LocaleProvider initial="en" locales={['en']}>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
