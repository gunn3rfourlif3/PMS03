import { DEFAULT_THEME, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('is light when unset — the production case', () => {
    expect(resolveTheme(undefined)).toBe('light');
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme('')).toBe('light');
    expect(DEFAULT_THEME).toBe('light');
  });

  it('serves dark when a deployment asks for it', () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('ignores case and surrounding space, so a hand-edited env file still works', () => {
    expect(resolveTheme('  DARK ')).toBe('dark');
    expect(resolveTheme('Light')).toBe('light');
  });

  // A typo must not blank the shell for staff who are working.
  it('degrades an unknown value to light rather than throwing', () => {
    expect(resolveTheme('drak')).toBe('light');
    expect(resolveTheme('midnight')).toBe('light');
  });
});
