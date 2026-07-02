import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Pure OTP helpers (no framework deps) so the crypto is unit-testable.
 * We store only an HMAC of the code, never the code itself.
 */

/** Cryptographically-random 6-digit numeric code, zero-padded. */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Deterministic keyed hash of a code for storage/comparison. */
export function hashOtp(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/** Constant-time comparison of a candidate code against a stored hash. */
export function verifyOtp(code: string, storedHash: string, secret: string): boolean {
  const candidate = Buffer.from(hashOtp(code, secret));
  const stored = Buffer.from(storedHash);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > expiresAt.getTime();
}
