/**
 * Pure deposit-return math (ZA Rental Housing Act). No DB/framework deps.
 *
 * The tenant is owed principal + accrued interest, less lawful deductions
 * (justified by the move-out inspection diff). Result classifies the outcome.
 */
import { DepositStatus } from './deposit.entity';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface DepositReturn {
  refund: number; // amount returned to tenant
  withheld: number; // amount kept (deductions)
  status: DepositStatus;
}

export function computeDepositReturn(
  principal: number,
  interestAccrued: number,
  deductions: number[],
): DepositReturn {
  const owed = round2(principal + interestAccrued);
  const withheld = round2(deductions.reduce((s, d) => s + Math.max(0, d), 0));
  const refund = round2(Math.max(0, owed - withheld));

  let status: DepositStatus;
  if (withheld <= 0) status = 'returned';
  else if (refund <= 0) status = 'forfeited';
  else status = 'partially_returned';

  return { refund, withheld, status };
}
