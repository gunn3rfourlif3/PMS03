import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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

  /** Register a new session for `ttlSec` seconds. */
  async create(jti: string, userId: string, ttlSec: number): Promise<void> {
    await this.redis.set(this.key(jti), userId, 'EX', ttlSec);
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
    await this.redis.del(this.key(jti));
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

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
