import { decideGoogleLink } from '../src/modules/auth/google-link';

describe('Google account linking decision', () => {
  const SUB = 'google-sub-123';

  it('signs in when a user already has this Google sub', () => {
    expect(decideGoogleLink(true, null, SUB)).toBe('use');
    // a sub match wins even if an email row also exists
    expect(decideGoogleLink(true, { googleSub: 'other' }, SUB)).toBe('use');
  });

  it('links when an email user has no Google account yet', () => {
    expect(decideGoogleLink(false, { googleSub: null }, SUB)).toBe('link');
    expect(decideGoogleLink(false, {}, SUB)).toBe('link');
  });

  it('links (idempotent) when the email user already has the same sub', () => {
    expect(decideGoogleLink(false, { googleSub: SUB }, SUB)).toBe('link');
  });

  it('rejects when the email belongs to a different Google account', () => {
    expect(decideGoogleLink(false, { googleSub: 'someone-else' }, SUB)).toBe('conflict');
  });

  it('creates a new user when nothing matches', () => {
    expect(decideGoogleLink(false, null, SUB)).toBe('create');
    expect(decideGoogleLink(false, undefined, SUB)).toBe('create');
  });
});
