import { InspectionItem } from './inspection.entity';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Total proposed deposit deduction from an inspection's damaged items. */
export function sumDeductions(items: InspectionItem[]): number {
  return round2((items ?? []).reduce((s, i) => s + Math.max(0, i.deductionAmount ?? 0), 0));
}

/** The positive per-item deduction amounts (fed to DepositService.returnDeposit). */
export function deductionList(items: InspectionItem[]): number[] {
  return (items ?? [])
    .map((i) => Math.max(0, i.deductionAmount ?? 0))
    .filter((n) => n > 0);
}
