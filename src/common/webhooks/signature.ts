import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 of the raw request body, hex-encoded. */
export function computeSignature(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Constant-time verification of a provider-supplied signature header. */
export function verifySignature(
  rawBody: Buffer | string,
  provided: string | undefined | null,
  secret: string,
): boolean {
  if (!secret || !provided) return false;
  const expected = Buffer.from(computeSignature(rawBody, secret));
  const got = Buffer.from(provided);
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}
