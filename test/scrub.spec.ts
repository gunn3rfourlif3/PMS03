import { scrub, scrubString, scrubHeaders, scrubUrl, REDACTED } from '../src/common/observability/scrub';

describe('scrubbing by key name', () => {
  it.each([
    'password', 'secret', 'token', 'authorization', 'cookie', 'apiKey',
    'banking', 'accountNumber', 'branchCode', 'idNumber', 'passportNumber',
    'otp', 'code', 'codeHash', 'credentials', 'signature', 'jti',
  ])('redacts %s', (key) => {
    expect((scrub({ [key]: 'sensitive-value' }) as any)[key]).toBe(REDACTED);
  });

  it('matches case and separator variants', () => {
    const out = scrub({ ID_Number: 'x', 'account-number': 'y', accessToken: 'z' }) as any;
    expect(out.ID_Number).toBe(REDACTED);
    expect(out['account-number']).toBe(REDACTED);
    expect(out.accessToken).toBe(REDACTED);
  });

  it('redacts at depth, not just the top level', () => {
    const out = scrub({ owner: { profile: { banking: { accountNumber: '62012345678' } } } }) as any;
    expect(out.owner.profile.banking).toBe(REDACTED);
  });

  it('keeps harmless keys so the report is still useful', () => {
    const out = scrub({ invoiceId: 'inv-9', period: '2026-08', status: 'issued' }) as any;
    expect(out).toEqual({ invoiceId: 'inv-9', period: '2026-08', status: 'issued' });
  });
});

// Key matching alone catches `idNumber`. It does not catch a bare value sitting
// in a message string or an innocently-named field.
describe('scrubbing by shape', () => {
  it('redacts an SA ID number wherever it appears', () => {
    expect(scrubString('lookup failed for 8001015009087')).not.toContain('8001015009087');
    expect((scrub({ note: 'ref 8001015009087' }) as any).note).toContain(REDACTED);
  });

  it('redacts a bare OTP', () => {
    expect(scrubString('[OTP] code is 623617')).not.toContain('623617');
  });

  it('redacts emails and SA phone numbers', () => {
    expect(scrubString('contact thabo@demo.test')).not.toContain('thabo@demo.test');
    expect(scrubString('call 0821234567')).not.toContain('0821234567');
    expect(scrubString('call +27821234567')).not.toContain('+27821234567');
  });

  it('redacts a long account number in free text', () => {
    expect(scrubString('paid into 62012345678')).not.toContain('62012345678');
  });

  it('leaves short numbers alone — dates and amounts stay readable', () => {
    expect(scrubString('invoice total 9200 for period 2026-08')).toContain('9200');
    expect(scrubString('unit 101')).toContain('101');
  });
});

describe('structural safety', () => {
  it('survives a cycle', () => {
    const a: any = { name: 'x' };
    a.self = a;
    expect(() => scrub(a)).not.toThrow();
    expect((scrub(a) as any).self).toBe('[circular]');
  });

  it('bounds depth', () => {
    let deep: any = 'bottom';
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(JSON.stringify(scrub(deep))).toContain('truncated: depth');
  });

  it('caps long arrays rather than exporting a table', () => {
    const out = scrub(Array.from({ length: 200 }, (_, i) => ({ i }))) as any[];
    expect(out.length).toBe(51);
    expect(out[50]).toContain('+150 more');
  });

  it('handles null, undefined and primitives', () => {
    expect(scrub(null)).toBeNull();
    expect(scrub(undefined)).toBeUndefined();
    expect(scrub(42)).toBe(42);
    expect(scrub(true)).toBe(true);
  });
});

describe('request metadata', () => {
  it('drops auth headers and webhook signatures', () => {
    const out = scrubHeaders({
      authorization: 'Bearer abc', cookie: 'session=1',
      'svix-signature': 'v1,xyz', 'ik-sign': 'abc',
      'content-type': 'application/json',
    });
    expect(out.authorization).toBe(REDACTED);
    expect(out.cookie).toBe(REDACTED);
    expect(out['svix-signature']).toBe(REDACTED);
    expect(out['content-type']).toBe('application/json'); // still useful
  });

  it('keeps query parameter names but not their values', () => {
    expect(scrubUrl('/api/partners/ref/ABC123?token=secret&id=9'))
      .toBe(`/api/partners/ref/ABC123?token=${REDACTED}&id=${REDACTED}`);
  });

  it('leaves a plain path untouched', () => {
    expect(scrubUrl('/api/health/ready')).toBe('/api/health/ready');
  });
});

// The cases that would actually have leaked, drawn from real payloads in this
// codebase.
describe('real payloads from this system', () => {
  it('scrubs an owner banking update', () => {
    const out = scrub({
      ownerId: '7123633a', banking: { accountHolder: 'S Dlamini', accountNumber: '62012345678', branchCode: '250655' },
    }) as any;
    expect(out.ownerId).toBe('7123633a');
    expect(out.banking).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('62012345678');
  });

  it('scrubs an OTP verify request', () => {
    const out = scrub({ destination: 'owner@demo.test', code: '623617', remember: true }) as any;
    expect(out.code).toBe(REDACTED);
    expect(out.destination).toBe(REDACTED); // email shape
    expect(out.remember).toBe(true);
  });

  it('scrubs a partner KYC submission', () => {
    const out = scrub({
      contactName: 'Thabo M',
      sensitive: { idNumber: '8001015009087' },
      banking: { accountNumber: '1234567890' },
    }) as any;
    expect(out.sensitive).toBe(REDACTED);
    expect(out.banking).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('8001015009087');
  });

  it('scrubs an encrypted PII blob rather than shipping ciphertext', () => {
    const out = scrub({ __enc: 1, iv: 'EGHo6hpO', tag: 'OewOF8TE', ct: 'jEjP7X+6K1J88eui' }) as any;
    expect(out.ct).toBe(REDACTED);
  });
});
