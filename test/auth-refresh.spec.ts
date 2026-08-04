import { AuthService } from '@modules/auth/auth.service';

/**
 * Regression: /auth/refresh must re-mint the FULL identity, not just roles.
 * A partner token that loses partnerId on refresh causes "No partner context";
 * an impersonation token that loses its act claim silently exits impersonation.
 */
function makeAuth() {
  const jwt: any = { signAsync: jest.fn(async () => 'signed.jwt.token') };
  const sessions: any = { touch: jest.fn(), create: jest.fn() };
  // Only jwt + sessions are exercised by refresh(); the rest are unused stubs.
  const svc = new AuthService({} as any, {} as any, jwt, {} as any, sessions, {} as any);
  return { svc, jwt, sessions };
}
const signedPayload = (jwt: any) => (jwt.signAsync as jest.Mock).mock.calls[0][0];

describe('AuthService.refresh preserves identity', () => {
  it('carries partnerId through a refresh', async () => {
    const { svc, jwt } = makeAuth();
    await svc.refresh({ userId: 'u1', vendorId: null, roles: ['partner'], partnerId: 'p1', jti: 'j1' });
    const p = signedPayload(jwt);
    expect(p.partnerId).toBe('p1');
    expect(p.roles).toEqual(['partner']);
    expect(p.jti).toBe('j1');
  });

  it('carries the impersonation act claim through a refresh', async () => {
    const { svc, jwt } = makeAuth();
    const act = { id: 'a1', email: 'admin@x.com', ev: 'ev1', agency: 'Acme' };
    await svc.refresh({ userId: 'admin', vendorId: 'v1', roles: ['property_manager'], act, jti: 'j2' });
    const p = signedPayload(jwt);
    expect(p.act).toEqual(act);
    expect(p.vendorId).toBe('v1');
  });

  it('omits partnerId/act for a plain vendor session', async () => {
    const { svc, jwt } = makeAuth();
    await svc.refresh({ userId: 'u', vendorId: 'v', roles: ['vendor_owner'], jti: 'j3' });
    const p = signedPayload(jwt);
    expect(p.partnerId).toBeUndefined();
    expect(p.act).toBeUndefined();
  });

  it('slides the existing session TTL rather than creating a new one', async () => {
    const { svc, sessions } = makeAuth();
    await svc.refresh({ userId: 'u', vendorId: null, roles: [], jti: 'j4' });
    expect(sessions.touch).toHaveBeenCalledWith('j4', expect.any(Number));
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
