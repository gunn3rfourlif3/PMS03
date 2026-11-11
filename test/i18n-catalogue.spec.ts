import { en } from '../shared/i18n/en';
import { zhHans } from '../shared/i18n/zh-Hans';

/**
 * What can be checked about a translation by machine, checked by machine.
 *
 * This suite does NOT say the Chinese is good. No test can: only a native
 * reviewer can tell you that 终止租约 says "terminate lease" and not something
 * that will embarrass you in front of a client. What it does is catch the
 * class of fault a reviewer reading a spreadsheet would miss — a dropped
 * placeholder, a key that no longer exists, an empty string — so the human
 * review can spend itself on meaning instead of mechanics.
 *
 * Coverage is deliberately NOT asserted at 100%. The catalogue is partial by
 * design and a missing key renders English, which is a working screen. A floor
 * is asserted so it cannot silently go backwards.
 */

const PLACEHOLDER = /\{(\w+)\}/g;
const placeholders = (s: string) =>
  ((s.match(PLACEHOLDER) ?? []).slice().sort().join(','));

const EN = en as unknown as Record<string, string>;
const ZH = zhHans as unknown as Record<string, string>;
const enKeys = Object.keys(EN);
const zhKeys = Object.keys(ZH);

describe('zh-Hans catalogue', () => {
  it('has no key that English does not have', () => {
    // A stale key is dead weight that looks like coverage: it will never be
    // rendered, and it inflates every count you use to judge progress.
    expect(zhKeys.filter((k) => !(k in EN))).toEqual([]);
  });

  it('carries exactly the placeholders of its English source', () => {
    // Placeholders are substituted by name. A dropped or renamed brace does
    // not throw — it renders a sentence with a hole in it, in front of the
    // client, in the language nobody on the team reads.
    const wrong = zhKeys
      .filter((k) => k in EN)
      .filter((k) => placeholders(EN[k]) !== placeholders(ZH[k]))
      .map((k) => `${k}\n    en: ${EN[k]}\n    zh: ${ZH[k]}`);
    expect(wrong).toEqual([]);
  });

  it('has no empty or whitespace-only value', () => {
    // An empty string is worse than a missing key: it defeats the English
    // fallback and renders blank.
    expect(zhKeys.filter((k) => !ZH[k]?.trim())).toEqual([]);
  });

  it('does not go backwards on coverage', () => {
    const pct = (zhKeys.length / enKeys.length) * 100;
    console.log(
      `\n  zh-Hans: ${zhKeys.length}/${enKeys.length} keys (${pct.toFixed(1)}%) ` +
      `— ${enKeys.length - zhKeys.length} fall back to English\n`,
    );
    expect(zhKeys.length).toBeGreaterThanOrEqual(260);
  });

  it('reports strings that are still English, for a reviewer to confirm', () => {
    // Not a failure: "OK", "PDF", a brand name and a bare number are all
    // legitimately unchanged. It is a worklist, printed so a reviewer can
    // confirm each one is deliberate rather than skipped.
    const unchanged = zhKeys
      .filter((k) => k in EN)
      .filter((k) => !/[一-鿿]/.test(ZH[k]));
    if (unchanged.length) {
      console.log(`\n  ${unchanged.length} value(s) contain no Chinese — confirm each is intentional:`);
      unchanged.forEach((k) => console.log(`    ${k} = ${JSON.stringify(ZH[k])}`));
      console.log('');
    }
    expect(Array.isArray(unchanged)).toBe(true);
  });
});
