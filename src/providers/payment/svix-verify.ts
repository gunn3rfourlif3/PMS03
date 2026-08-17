import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Svix webhook signature verification (Stitch dispatches through Svix).
 *
 * signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
 * signature     = base64( HMAC-SHA256( base64decode(secret after "whsec_"), signedContent ) )
 *
 * Implemented directly rather than pulling in the `svix` package: it is ~20
 * lines of standard crypto, and a payment-critical dependency is worth avoiding
 * when the alternative is this small.
 *
 * Three things this gets right that a naive version does not:
 *
 *   · The RAW body. Parsing to JSON and re-stringifying changes whitespace and
 *     key order, and the signature is over bytes. Nest is booted with
 *     `rawBody: true` precisely so this is available.
 *   · EVERY signature in the header. `svix-signature` is a space-delimited list
 *     of `v1,<sig>` pairs, and during a secret rotation more than one is valid.
 *     Checking only the first breaks silently mid-rotation.
 *   · Timestamp tolerance. Without it a captured payload replays forever, and
 *     since these mark invoices paid, that is a real attack rather than a
 *     theoretical one.
 */

const DEFAULT_TOLERANCE_SEC = 5 * 60;

export interface SvixVerifyInput {
  id?: string;
  timestamp?: string;
  signatureHeader?: string;
  rawBody: string;
  secret?: string;
  toleranceSec?: number;
  now?: Date;
}

export type SvixVerdict =
  | { ok: true }
  | { ok: false; reason: 'missing_secret' | 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

/** Constant-time compare that tolerates unequal lengths without leaking them. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifySvixSignature(input: SvixVerifyInput): SvixVerdict {
  const { id, timestamp, signatureHeader, rawBody, secret } = input;
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: 'missing_headers' };

  const tolerance = input.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  const sent = Number(timestamp);
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(sent) || Math.abs(now - sent) > tolerance) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  // The secret is transported as "whsec_<base64>"; only the base64 part is key
  // material. Tolerate a secret pasted without the prefix.
  const keyPart = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = Buffer.from(keyPart, 'base64');

  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  const provided = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(',') ? part.slice(part.indexOf(',') + 1) : part));

  return provided.some((sig) => safeEqual(sig, expected))
    ? { ok: true }
    : { ok: false, reason: 'bad_signature' };
}
