import { planGrant, checkRevoke } from '../src/modules/auth/platform-admin-rules';

const grant = (o: any = {}) => planGrant({ email: 'sam@locare.co.za', note: 'Ops hire', ...o });
const ok = <T>(r: any): T => { if (!r.ok) throw new Error(r.error); return r.value; };
const no = (r: any): string => { if (r.ok) throw new Error('expected a refusal'); return r.error; };

describe('granting platform admin', () => {
  it('normalises the address, because sign-in matches on it', () => {
    expect(ok<any>(grant({ email: '  Sam@Locare.CO.ZA  ' })).email).toBe('sam@locare.co.za');
  });

  it('requires a real address', () => {
    expect(no(grant({ email: '' }))).toMatch(/Enter the email/);
    expect(no(grant({ email: 'sam' }))).toMatch(/not an email/);
    expect(no(grant({ email: 'sam@localhost' }))).toMatch(/not an email/);
  });

  it('requires a reason, because nothing else records one', () => {
    expect(no(grant({ note: '' }))).toMatch(/Say why/);
    expect(no(grant({ note: '   ' }))).toMatch(/Say why/);
    expect(no(grant({ note: 'x'.repeat(301) }))).toMatch(/under 300/);
  });

  it('treats a missing name as absent rather than refusing', () => {
    expect(ok<any>(grant({ name: '' })).name).toBeNull();
    expect(ok<any>(grant({ name: '  Sam   Nkosi ' })).name).toBe('Sam Nkosi');
  });
});

describe('revoking platform admin', () => {
  const base = { actorEmail: 'vernon@locare.co.za', targetEmail: 'sam@locare.co.za', activeCount: 3 };

  it('allows a normal revoke', () => {
    expect(checkRevoke(base).ok).toBe(true);
  });

  it('refuses self-revoke, whatever the casing', () => {
    expect(no(checkRevoke({ ...base, targetEmail: 'vernon@locare.co.za' }))).toMatch(/your own access/);
    expect(no(checkRevoke({ ...base, targetEmail: '  VERNON@locare.co.za ' }))).toMatch(/your own access/);
  });

  it('refuses to remove the last admin', () => {
    // Even when it is someone else: one active grant means the platform has one
    // way in, and this would close it.
    expect(no(checkRevoke({ ...base, activeCount: 1 }))).toMatch(/last platform admin/);
    expect(no(checkRevoke({ ...base, activeCount: 0 }))).toMatch(/last platform admin/);
  });

  it('checks self-revoke before the count, so the message is the useful one', () => {
    const r = checkRevoke({ actorEmail: 'v@l.co.za', targetEmail: 'v@l.co.za', activeCount: 1 });
    expect(no(r)).toMatch(/your own access/);
  });

  it('refuses when no target is given', () => {
    expect(no(checkRevoke({ ...base, targetEmail: '' }))).toMatch(/No operator/);
  });
});
