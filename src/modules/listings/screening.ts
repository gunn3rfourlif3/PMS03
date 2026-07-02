/**
 * Pure applicant screening (no DB/framework). Combines income-to-rent ratio and
 * credit score into a recommendation. Deterministic + unit-testable; the actual
 * approve/decline decision stays with a human unless auto-rules are enabled.
 */
export interface ScreeningInput {
  monthlyIncome?: number;
  creditScore?: number;
  rent: number;
}

export interface ScreeningResult {
  recommendation: 'approve' | 'review' | 'decline';
  incomeToRent: number | null;
  reasons: string[];
}

const MIN_RATIO = 3;      // income should be >= 3x rent
const GOOD_CREDIT = 650;
const POOR_CREDIT = 550;

export function screen(input: ScreeningInput): ScreeningResult {
  const reasons: string[] = [];
  const ratio =
    input.monthlyIncome && input.rent > 0 ? input.monthlyIncome / input.rent : null;

  const incomeOk = ratio !== null && ratio >= MIN_RATIO;
  const incomeBad = ratio !== null && ratio < MIN_RATIO;
  const creditOk = input.creditScore !== undefined && input.creditScore >= GOOD_CREDIT;
  const creditBad = input.creditScore !== undefined && input.creditScore < POOR_CREDIT;

  if (ratio !== null) reasons.push(`income-to-rent ${ratio.toFixed(2)}x`);
  if (input.creditScore !== undefined) reasons.push(`credit ${input.creditScore}`);

  let recommendation: ScreeningResult['recommendation'];
  if (incomeBad || creditBad) recommendation = 'decline';
  else if (incomeOk && creditOk) recommendation = 'approve';
  else recommendation = 'review';

  return { recommendation, incomeToRent: ratio, reasons };
}
