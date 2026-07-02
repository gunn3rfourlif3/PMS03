import { DepositPolicy, DepositReturnWindow } from '../policy.interfaces';

/**
 * ZA Rental Housing Act s5(3): interest-bearing account, interest owed to
 * tenant, written proof within 14 days, return within 7 / 14 / 21 days.
 */
export class ZaRhaDepositPolicy implements DepositPolicy {
  readonly key = 'ZA_RHA';
  readonly requiresInterestBearing = true;
  readonly proofToTenantWithinDays = 14;
  returnWindows(): DepositReturnWindow[] {
    return [
      { scenario: 'no_deductions', days: 7 },
      { scenario: 'deductions_after_inspection', days: 14 },
      { scenario: 'tenant_no_show', days: 21 },
    ];
  }
}
