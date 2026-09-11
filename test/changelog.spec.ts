import { CHANGELOG, CATEGORY_LABEL, unsentEntries, entryById } from '../src/modules/changelog/changelog-entries';
import { dedupeRecipients, fromEnvList, countBySource, Recipient } from '../src/modules/changelog/changelog-recipients';

describe('changelog entries', () => {
  it('has permanent, unique ids', () => {
    // The id is how the system knows what has already been emailed. Renaming one
    // re-sends it to every partner, which is the one mistake with no undo.
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
  });

  it('is newest first', () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('stays out of technical language', () => {
    // If an entry needs a function name to explain it, it is not an entry a
    // partner needed to read, and an update nobody needed teaches people to stop
    // opening the next one.
    // "Migration" is deliberately absent from this list: in property software the
    // data migration is what you call it to the principal's face. The words here
    // are the ones that only mean something to whoever wrote the code.
    const jargon = /\b(endpoint|RLS|schema|deploy(ed|ment)?|refactor|commit|nullable|env var|typescript|database)\b/i;
    for (const e of CHANGELOG) {
      expect(`${e.title} ${e.body} ${e.action ?? ''}`).not.toMatch(jargon);
      expect(e.title.length).toBeLessThan(80);
      expect(CATEGORY_LABEL[e.category]).toBeTruthy();
    }
  });

  it('finds and filters by id', () => {
    expect(entryById(CHANGELOG[0].id)).toBe(CHANGELOG[0]);
    expect(entryById('nope')).toBeUndefined();
    expect(unsentEntries([])).toHaveLength(CHANGELOG.length);
    expect(unsentEntries(CHANGELOG.map((e) => e.id))).toHaveLength(0);
    expect(unsentEntries([CHANGELOG[0].id])).toHaveLength(CHANGELOG.length - 1);
  });
});

describe('recipients', () => {
  const r = (email: string, source: Recipient['source'] = 'partner'): Recipient => ({ email, source });

  it('counts a person once, keeping the first source', () => {
    // An approved applicant IS a partner — approve() creates the partner row —
    // so the same address arrives twice and must not be mailed twice.
    const out = dedupeRecipients([r('a@x.co.za', 'partner'), r('A@X.CO.ZA', 'applicant')]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('partner');
  });

  it('never mails an unreachable demo address', () => {
    // The demo agencies use .invalid precisely so nothing reaches a person.
    // A fixture must not be able to appear in a real send.
    expect(dedupeRecipients([r('owner@demo-northcliff.invalid')])).toHaveLength(0);
    expect(dedupeRecipients([r('x@y.test'), r('x@y.example'), r('x@localhost')])).toHaveLength(0);
  });

  it('drops rubbish without dropping unusual-but-valid addresses', () => {
    expect(dedupeRecipients([r(''), r('  '), r('not-an-email'), r('@x.co.za')])).toHaveLength(0);
    expect(dedupeRecipients([r('first.last+tag@sub.example.co.za')])).toHaveLength(1);
  });

  it('trims whitespace around an address', () => {
    expect(dedupeRecipients([r('  a@x.co.za  ')])[0].email).toBe('a@x.co.za');
  });

  it('splits env lists on commas and semicolons', () => {
    expect(fromEnvList('a@x.co.za, b@y.co.za; c@z.co.za', 'extra').map((x) => x.email))
      .toEqual(['a@x.co.za', 'b@y.co.za', 'c@z.co.za']);
    expect(fromEnvList(undefined, 'admin')).toEqual([]);
    expect(fromEnvList('  ', 'admin')).toEqual([]);
  });

  it('counts by source for the preview', () => {
    const out = countBySource([r('a@x.co.za', 'partner'), r('b@x.co.za', 'partner'), r('c@x.co.za', 'admin')]);
    expect(out).toEqual({ partner: 2, applicant: 0, admin: 1, extra: 0 });
  });
});
