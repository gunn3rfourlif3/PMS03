/**
 * Reference derivation for Stitch payment requests.
 *
 * Stitch caps the two references that appear on real bank statements:
 *   payerReference       ≤ 12 chars — shown on the TENANT's statement
 *   beneficiaryReference ≤ 20 chars — shown on the AGENCY's statement
 *
 * Our invoice ids are 36-character UUIDs, so both have to be derived. Blind
 * truncation of a UUID gives something the tenant cannot recognise on their
 * statement and support cannot search on, so the payer reference leads with a
 * word and the machine-matchable value goes in `externalReference`, which
 * allows 4096 characters.
 *
 * Pure and separately tested: getting this wrong is only visible on a real bank
 * statement, which is the worst possible place to discover it.
 */

/** Hex of a UUID, uppercased — dashes carry no information and cost 4 chars. */
const compact = (id: string) => (id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const PAYER_REF_MAX = 12;
export const BENEFICIARY_REF_MAX = 20;

/**
 * What the tenant sees on their bank statement. A recognisable word plus enough
 * of the invoice id to tie a query back to a record.
 *
 * `prefix` should be short and meaningful to a payer — "RENT", "DEPOSIT". It is
 * truncated rather than rejected, because a mis-set env var must not stop rent
 * being collected.
 */
export function payerReference(invoiceId: string, prefix = 'RENT'): string {
  const p = (prefix || 'RENT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'RENT';
  return `${p}${compact(invoiceId).slice(0, PAYER_REF_MAX - p.length)}`.slice(0, PAYER_REF_MAX);
}

/**
 * What the agency sees on theirs. No prefix — the agency's whole statement is
 * rent, so the identifier is worth more than the word.
 */
export function beneficiaryReference(invoiceId: string): string {
  return compact(invoiceId).slice(0, BENEFICIARY_REF_MAX);
}

/** Stitch takes an object with a decimal quantity, not cents. */
export function moneyInput(amount: number, currency = 'ZAR'): { quantity: number; currency: string } {
  return { quantity: Math.round((Number(amount) || 0) * 100) / 100, currency };
}
