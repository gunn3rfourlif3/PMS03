import { toE164, isE164 } from '@common/phone/e164';

describe('toE164 (South Africa)', () => {
  it('normalises a local 0-prefixed number', () => {
    expect(toE164('082 123 4567')).toBe('+27821234567');
    expect(toE164('082-123-4567')).toBe('+27821234567');
  });
  it('keeps an already-international number', () => {
    expect(toE164('+27 82 123 4567')).toBe('+27821234567');
    expect(toE164('27821234567')).toBe('+27821234567');
  });
  it('handles the 00 international prefix', () => {
    expect(toE164('0027821234567')).toBe('+27821234567');
  });
  it('assumes ZA for a bare local number without leading 0', () => {
    expect(toE164('821234567')).toBe('+27821234567');
  });
  it('returns null for junk / too-short / empty', () => {
    expect(toE164('123')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});

describe('isE164', () => {
  it('accepts well-formed and rejects malformed', () => {
    expect(isE164('+27821234567')).toBe(true);
    expect(isE164('0821234567')).toBe(false);
    expect(isE164('')).toBe(false);
    expect(isE164(undefined)).toBe(false);
  });
});
