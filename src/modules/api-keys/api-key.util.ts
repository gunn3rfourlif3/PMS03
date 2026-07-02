import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export interface GeneratedKey { plaintext: string; prefix: string; hash: string; }

/** Format: pms_<8-hex prefix>_<48-hex secret>. Only the hash is persisted. */
export function generateApiKey(): GeneratedKey {
  const prefix = randomBytes(4).toString('hex');   // 8 hex chars
  const secret = randomBytes(24).toString('hex');  // 48 hex chars
  const plaintext = `pms_${prefix}_${secret}`;
  return { plaintext, prefix, hash: hashKey(plaintext) };
}

export function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Extract the lookup prefix from a presented key, or null if malformed. */
export function parsePrefix(plaintext: string | undefined | null): string | null {
  if (!plaintext) return null;
  const m = /^pms_([0-9a-f]{8})_[0-9a-f]{48}$/.exec(plaintext);
  return m ? m[1] : null;
}

/** Constant-time comparison of a presented key against a stored hash. */
export function verifyKey(plaintext: string, storedHash: string): boolean {
  const a = Buffer.from(hashKey(plaintext));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
