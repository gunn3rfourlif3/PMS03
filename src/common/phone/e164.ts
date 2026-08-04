/**
 * Phone normalisation to E.164 (`+27…`), South-Africa-centric. WhatsApp/SMS need
 * a canonical international number; UI inputs are messy (`082 123 4567`,
 * `+27 82…`, `082-123-4567`). Returns null when there aren't enough digits.
 */
export function toE164(raw?: string | null, defaultCc = '27'): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const hadPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (hadPlus) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`; // 0027… international prefix
  if (digits.startsWith('0')) return `+${defaultCc}${digits.slice(1)}`; // 082… local → +2782…
  if (digits.startsWith(defaultCc)) return `+${digits}`; // already 2782…
  return `+${defaultCc}${digits}`; // bare local without leading 0
}

/** True for a well-formed E.164 string. */
export function isE164(s?: string | null): boolean {
  return !!s && /^\+[1-9]\d{7,14}$/.test(s);
}
