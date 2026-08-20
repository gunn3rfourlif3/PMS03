/**
 * PII scrubbing for anything leaving the box — error reports, breadcrumbs,
 * structured logs.
 *
 * POPIA applies to an error payload exactly as it applies to a database row.
 * An unhandled 500 in the payments module can carry a tenant's ID number, an
 * owner's bank account, or a live OTP straight to a third-party processor in
 * another country, and nobody notices because nobody reads their own crash
 * reports that closely.
 *
 * Two deliberate choices:
 *
 *   · **Scrubbing lives here, not in the Sentry dashboard.** Provider-side
 *     filtering is a setting someone can change; this is code, reviewed and
 *     tested. If the two disagree, this one wins because it runs first.
 *   · **Deny by shape, not just by name.** Key matching catches `idNumber`;
 *     it does not catch `{ value: "8001015009087" }`. Values that look like SA
 *     ID numbers, long account numbers, card-like digits and OTP codes are
 *     redacted wherever they appear.
 *
 * The bias is toward over-redacting. A slightly less useful stack trace is a
 * cheap price for not exporting a tenant's identity document number.
 */

export const REDACTED = '[redacted]';

/** Key names whose values never leave the server, at any nesting depth. */
const SENSITIVE_KEYS = [
  // credentials and secrets
  'password', 'passphrase', 'secret', 'token', 'accesstoken', 'refreshtoken',
  'apikey', 'api_key', 'authorization', 'cookie', 'credentials', 'clientsecret',
  'privatekey', 'signature', 'devicetoken', 'jti',
  // one-time codes — the plaintext OTP exists in exactly one place and this is not it
  'otp', 'code', 'codehash', 'pin',
  // banking and payment instruments
  'banking', 'bankaccount', 'accountnumber', 'branchcode', 'cardnumber', 'pan',
  'cvv', 'iban', 'usercode', 'debicheck_user_code',
  // identity
  'idnumber', 'id_number', 'identitydocument', 'passportnumber', 'taxnumber',
  'vatnumber',
  // the encrypted blobs — already ciphertext, but no reason to ship them
  'sensitive', 'ct',
];

/** SA ID: 13 digits. Also catches most long account numbers. */
const LONG_DIGITS = /\b\d{9,20}\b/g;
/** 6-digit code on its own — an OTP, and cheap to lose. */
const OTP_LIKE = /(?<!\d)\d{6}(?!\d)/g;
/** Anything that looks like an email address. */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** SA mobile numbers in local or E.164 form. */
const PHONE = /(?:\+27|0)\d{9}\b/g;

const isSensitiveKey = (key: string): boolean => {
  const k = key.toLowerCase().replace(/[^a-z_]/g, '');
  return SENSITIVE_KEYS.some((s) => k === s || k.includes(s));
};

/** Redact PII-shaped substrings inside a free-text value. */
export function scrubString(value: string): string {
  return value
    .replace(EMAIL, REDACTED)
    .replace(PHONE, REDACTED)
    .replace(LONG_DIGITS, REDACTED)
    .replace(OTP_LIKE, REDACTED);
}

/**
 * Deep-scrub any value. Cycles are handled, depth is bounded, and long arrays
 * are truncated — an error report is a diagnostic, not a data export.
 */
export function scrub(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (input == null) return input;
  if (depth > 8) return '[truncated: depth]';

  if (typeof input === 'string') return scrubString(input);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (input instanceof Date) return input.toISOString();

  if (typeof input === 'object') {
    if (seen.has(input as object)) return '[circular]';
    seen.add(input as object);

    if (Array.isArray(input)) {
      const capped = input.slice(0, 50).map((v) => scrub(v, depth + 1, seen));
      return input.length > 50 ? [...capped, `[+${input.length - 50} more]`] : capped;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : scrub(v, depth + 1, seen);
    }
    return out;
  }

  return String(input);
}

/** Headers to drop wholesale before a request is attached to a report. */
export function scrubHeaders(headers: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isSensitiveKey(k) ? REDACTED : scrub(v);
  }
  return out;
}

/**
 * A query string can carry a device token or a payment reference, and it ends
 * up in the URL on every report. Values go; the shape of the request stays,
 * because knowing *which* parameters were present is usually the diagnostic.
 */
export function scrubUrl(url: string): string {
  const [path, query] = url.split('?');
  if (!query) return path;
  const keys = query.split('&').map((p) => p.split('=')[0]).filter(Boolean);
  return keys.length ? `${path}?${keys.map((k) => `${k}=${REDACTED}`).join('&')}` : path;
}
