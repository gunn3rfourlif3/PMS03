/**
 * Locare's own banking details, for agencies paying a subscription invoice by
 * EFT.
 *
 * Read from the environment and never committed. Account numbers in a git
 * repository are permanent, travel to every clone and every collaborator, and
 * cannot be rotated by editing a file — so `deploy/.env.prod.example` carries
 * placeholders and the real values live only in `deploy/.env.prod` on the VPS.
 *
 * Returns null unless the account number and branch code are both set, so an
 * unconfigured deployment shows nothing rather than a half-filled panel an
 * agency might try to pay into.
 */
export interface PayToDetails {
  bank: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swift?: string;
}

export function payToDetails(): PayToDetails | null {
  const accountNumber = (process.env.PAYTO_ACCOUNT_NUMBER ?? '').trim();
  const branchCode = (process.env.PAYTO_BRANCH_CODE ?? '').trim();
  if (!accountNumber || !branchCode) return null;
  return {
    bank: (process.env.PAYTO_BANK ?? 'First National Bank').trim(),
    accountName: (process.env.PAYTO_ACCOUNT_NAME ?? 'Locare (Pty) Ltd').trim(),
    accountNumber,
    branchCode,
    swift: (process.env.PAYTO_SWIFT ?? '').trim() || undefined,
  };
}

/**
 * The reference an agency must use on the EFT.
 *
 * EFT reconciliation is manual — someone reads a bank statement and marks the
 * invoice paid — so the reference has to identify the agency AND the period,
 * and fit a bank's ~20-character field. A UUID does neither.
 *   e.g. DANTALAN-2026-09
 */
export function payToReference(slug: string | null | undefined, period: string): string {
  const agency = (slug ?? 'AGENCY').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `${agency}-${period}`;
}
