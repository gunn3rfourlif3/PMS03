/**
 * Mapping from the free-text bank name we capture on an owner's banking details
 * to Stitch's `DisbursementBankBeneficiaryBankId` enum.
 *
 * Owners' bank names are typed by agency staff, so "FNB", "First National Bank"
 * and "fnb " all arrive. Stitch takes an enum. An unmapped name must fail
 * loudly rather than be guessed at — sending a payout to the wrong bank id is
 * not recoverable by us, and the disbursement error reasons list
 * `invalid_transaction_details` as a real outcome.
 *
 * Branch code is a better key than the name where we have it: it is numeric,
 * unambiguous, and already validated against the universal branch codes in
 * web-admin/lib/za-banks.ts.
 */

export type StitchBankId =
  | 'absa' | 'capitec' | 'fnb' | 'investec' | 'nedbank' | 'standardbank'
  | 'tymebank' | 'african_bank' | 'bidvest_bank' | 'discovery_bank'
  | 'sasfin_bank' | 'bank_zero' | 'access_bank' | 'grindrod_bank';

/** Universal branch code → Stitch bank id. The most reliable signal we hold. */
const BY_BRANCH_CODE: Record<string, StitchBankId> = {
  '632005': 'absa',
  '470010': 'capitec',
  '250655': 'fnb',
  '580105': 'investec',
  '198765': 'nedbank',
  '051001': 'standardbank',
  '678910': 'tymebank',
  '430000': 'african_bank',
  '462005': 'bidvest_bank',
  '679000': 'discovery_bank',
  '683000': 'sasfin_bank',
  '888000': 'bank_zero',
  '410105': 'access_bank',
  '584000': 'grindrod_bank',
};

/** Normalised name fragments → Stitch bank id. Order matters: longest first. */
const BY_NAME: Array<[RegExp, StitchBankId]> = [
  [/standard\s*bank|stanbic/i, 'standardbank'],
  [/first\s*national|fnb/i, 'fnb'],
  [/absa/i, 'absa'],
  [/capitec/i, 'capitec'],
  [/investec/i, 'investec'],
  [/nedbank|ned\s*bank/i, 'nedbank'],
  [/tyme/i, 'tymebank'],
  [/african\s*bank/i, 'african_bank'],
  [/bidvest/i, 'bidvest_bank'],
  [/discovery/i, 'discovery_bank'],
  [/sasfin/i, 'sasfin_bank'],
  [/bank\s*zero/i, 'bank_zero'],
  [/access\s*bank|grobank/i, 'access_bank'],
  [/grindrod/i, 'grindrod_bank'],
];

export function toStitchBankId(bankName?: string, branchCode?: string): StitchBankId | undefined {
  const code = (branchCode ?? '').replace(/\D/g, '');
  if (code && BY_BRANCH_CODE[code]) return BY_BRANCH_CODE[code];

  const name = (bankName ?? '').trim();
  if (!name) return undefined;
  return BY_NAME.find(([re]) => re.test(name))?.[1];
}

/** Stitch's AccountType enum. Ours is free text and frequently blank. */
export function toStitchAccountType(accountType?: string): 'current' | 'savings' | 'transmission' {
  const t = (accountType ?? '').toLowerCase();
  if (t.includes('sav')) return 'savings';
  if (t.includes('transmission')) return 'transmission';
  // "Current"/"cheque" are the same thing in SA, and the commonest business
  // account — the right default when the field was left empty.
  return 'current';
}

/**
 * INSTANT clears immediately at extra cost; DEFAULT clears same-day. Three banks
 * do not support INSTANT at all, so asking for it there would fail rather than
 * downgrade.
 */
const NO_INSTANT = new Set<StitchBankId>(['grindrod_bank']);

export function disbursementType(bankId: StitchBankId, preferInstant: boolean): 'INSTANT' | 'DEFAULT' {
  return preferInstant && !NO_INSTANT.has(bankId) ? 'INSTANT' : 'DEFAULT';
}
