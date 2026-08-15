/**
 * South African banks and their universal branch codes.
 *
 * Universal branch codes are the single code a bank accepts for EFT to ANY of
 * its branches, which is why a dropdown works at all here: pick the bank and the
 * branch code is determined. Partners typing it by hand was the failure mode —
 * a wrong branch code fails or misroutes a commission payout, and the applicant
 * has no way to know until the money doesn't arrive.
 *
 * Source: Peach Payments' payout documentation (a processor that has to get this
 * right to move money), cross-checked against published universal codes.
 * https://support.peachpayments.com/support/solutions/articles/47001207209
 *
 * Codes change rarely — the majors have held theirs for years — but if a payout
 * is rejected for an invalid branch code, verify against the bank directly
 * before editing this list.
 */
export interface ZaBank {
  name: string;
  branchCode: string;
}

/** Ordered so the banks most partners actually use are at the top of the list. */
export const ZA_BANKS: ZaBank[] = [
  { name: 'Absa Bank', branchCode: '632005' },
  { name: 'Capitec Bank', branchCode: '470010' },
  { name: 'First National Bank (FNB)', branchCode: '250655' },
  { name: 'Nedbank', branchCode: '198765' },
  { name: 'Standard Bank', branchCode: '051001' },
  { name: 'TymeBank / GoTyme Bank', branchCode: '678910' },
  { name: 'African Bank', branchCode: '430000' },
  { name: 'Discovery Bank', branchCode: '679000' },
  { name: 'Investec Bank', branchCode: '580105' },
  { name: 'Bank Zero', branchCode: '888000' },
  { name: 'Bidvest Bank', branchCode: '462005' },
  { name: 'Capitec Business', branchCode: '450105' },
  { name: 'Access Bank South Africa', branchCode: '410105' },
  { name: 'Albaraka Bank', branchCode: '800000' },
  { name: 'Finbond Mutual Bank', branchCode: '589000' },
  { name: 'Grindrod Bank', branchCode: '584000' },
  { name: 'Sasfin Bank', branchCode: '683000' },
  { name: 'South African Postbank', branchCode: '460005' },
];

/** Sentinel for banks not on the list — the applicant types both fields. */
export const BANK_OTHER = 'Other';

export const branchCodeFor = (bankName: string): string =>
  ZA_BANKS.find((b) => b.name === bankName)?.branchCode ?? '';
