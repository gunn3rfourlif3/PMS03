import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import Redis from 'ioredis';

/**
 * Redis-backed session registry for instant, server-enforced token revocation.
 *
 * Every access token carries a session id (`jti`). A key `sess:<jti>` exists in
 * Redis for as long as the session is valid, with a TTL equal to the idle
 * window. The JWT strategy checks this key on every authenticated request, so:
 *   - logout / admin revoke  → DEL the key → the token dies on the next request
 *   - idle past the window   → the key's TTL lapses → the token stops working
 * This closes the gap left by stateless JWTs (which otherwise stay valid until
 * their own expiry even after sign-out).
 */
@Injectable()
export class SessionStore implements OnModuleDestroy {
  private readonly log = new Logger('SessionStore');
  private readonly redis: Redis;
  private readonly prefix = 'sess:';

  constructor() {
    const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.redis = new Redis({
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.redis.on('error', (e) => this.log.warn(`redis: ${e.message}`));
  }

  private key(jti: string) { return this.prefix + jti; }
  /** Reverse index: every live session id for one user. */
  private userKey(userId: string) { return `usess:${userId}`; }

  /** Register a new session for `ttlSec` seconds. */
  async create(jti: string, userId: string, ttlSec: number): Promise<void> {
    await this.redis.set(this.key(jti), userId, 'EX', ttlSec);
    // Index it so an admin revoke can reach every device this person is signed
    // in on. Members may outlive their session key; deleting an absent key is a
    // no-op, so a stale member costs nothing.
    await this.redis.sadd(this.userKey(userId), jti);
    await this.redis.expire(this.userKey(userId), ttlSec * 4);
  }

  /** Is this session still valid (not revoked / not idle-expired)? */
  async exists(jti: string): Promise<boolean> {
    return (await this.redis.exists(this.key(jti))) === 1;
  }

  /** Slide the idle window forward on genuine activity (refresh). */
  async touch(jti: string, ttlSec: number): Promise<void> {
    await this.redis.expire(this.key(jti), ttlSec);
  }

  /** Instantly revoke a session (logout). */
  async revoke(jti: string): Promise<void> {
    const userId = await this.redis.get(this.key(jti));
    await this.redis.del(this.key(jti));
    if (userId) await this.redis.srem(this.userKey(userId), jti);
  }

  /**
   * Revoke EVERY session a user holds, on every device. Used when platform-admin
   * access is withdrawn: leaving their current token alive would mean a revoked
   * operator keeps admin rights until their idle window lapses, which is the
   * whole failure R-2 exists to close.
   *
   * Returns how many sessions were killed, so the audit line can say.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const key = this.userKey(userId);
    const jtis = await this.redis.smembers(key);
    if (jtis.length === 0) return 0;
    const killed = await this.redis.del(...jtis.map((j) => this.key(j)));
    await this.redis.del(key);
    return killed;
  }

  /** Store a short-lived, single-use value (e.g. the Google one-time return code). */
  async putCode(code: string, value: string, ttlSec: number): Promise<void> {
    await this.redis.set('otc:' + code, value, 'EX', ttlSec);
  }

  /** Read-and-delete a one-time code (single use). Returns null if absent/expired. */
  async takeCode(code: string): Promise<string | null> {
    const k = 'otc:' + code;
    const v = await this.redis.get(k);
    if (v !== null) await this.redis.del(k);
    return v;
  }

  // ── Trusted devices ──
  // A "remember this device" secret lets a returning user re-auth WITHOUT a fresh
  // OTP (so we don't pay for a WhatsApp/SMS code every login). The raw token lives
  // only on the client; we store sha256(token) → userId with a sliding TTL, and
  // rotate the token on every exchange so a captured token is single-use.
  private devKey(token: string) { return 'dev:' + createHash('sha256').update(token).digest('hex'); }

  /** Mint a trusted-device token bound to a user for `ttlSec`. Returns the raw token. */
  async createDevice(userId: string, ttlSec: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(this.devKey(token), userId, 'EX', ttlSec);
    return token;
  }

  /** Validate + rotate a trusted-device token. Returns { userId, token(new) } or null. */
  async rotateDevice(token: string, ttlSec: number): Promise<{ userId: string; token: string } | null> {
    if (!token) return null;
    const userId = await this.redis.get(this.devKey(token));
    if (userId === null) return null;
    await this.redis.del(this.devKey(token)); // burn the presented token
    const next = randomBytes(32).toString('base64url');
    await this.redis.set(this.devKey(next), userId, 'EX', ttlSec);
    return { userId, token: next };
  }

  /** Forget a trusted device (sign out of this device). */
  async revokeDevice(token: string): Promise<void> {
    if (token) await this.redis.del(this.devKey(token));
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
