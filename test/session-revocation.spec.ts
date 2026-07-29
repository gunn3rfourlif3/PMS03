import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import type { SessionStore } from '../src/modules/auth/session-store.service';

/** In-memory stand-in for the Redis-backed SessionStore (no Redis in unit tests). */
class FakeSessionStore {
  private live = new Map<string, string>();
  async create(jti: string, userId: string) { this.live.set(jti, userId); }
  async exists(jti: string) { return this.live.has(jti); }
  async touch() { /* no-op */ }
  async revoke(jti: string) { this.live.delete(jti); }
}

describe('instant session revocation', () => {
  it('accepts a live session, then rejects the same token after logout (401)', async () => {
    const sessions = new FakeSessionStore();
    const strategy = new JwtStrategy(sessions as unknown as SessionStore);

    // Log in: a session is registered and the token carries its id.
    const jti = 'sess-123';
    await sessions.create(jti, 'user-1');
    const token = { sub: 'user-1', vendorId: 'v1', roles: ['vendor_owner'], jti };

    // A request with a live session is accepted.
    await expect(strategy.validate(token)).resolves.toMatchObject({ userId: 'user-1', jti });

    // Sign out — AuthService.logout(jti) delegates to sessions.revoke(jti).
    await sessions.revoke(jti);

    // The very next request with the same token is rejected — instant revocation.
    await expect(strategy.validate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets legacy tokens without a session id through (they age out on their own)', async () => {
    const sessions = new FakeSessionStore();
    const strategy = new JwtStrategy(sessions as unknown as SessionStore);
    await expect(
      strategy.validate({ sub: 'user-9', vendorId: null, roles: [] as string[] }),
    ).resolves.toMatchObject({ userId: 'user-9' });
  });
});
