/**
 * Market policy interfaces. The *rules* live in typed, tested code; the
 * *selection* lives in vendor.config (e.g. tax_profile: "ZA_VAT").
 * Adding a market = new implementations behind these interfaces.
 */

export interface TaxProfile {
  readonly key: string;         // e.g. 'ZA_VAT'
  readonly ratePct: number;
  computeTax(amountExclTax: number): number;
}

export interface DepositReturnWindow {
  scenario: 'no_deductions' | 'deductions_after_inspection' | 'tenant_no_show';
  days: number;
}

export interface DepositPolicy {
  readonly key: string;                 // e.g. 'ZA_RHA'
  readonly requiresInterestBearing: boolean;
  readonly proofToTenantWithinDays: number;
  returnWindows(): DepositReturnWindow[];
}

export interface CompliancePolicy {
  readonly key: string;                 // e.g. 'ZA_PPRA'
  /** True if a vendor collecting rent on behalf of owners may legally do so. */
  canCollectOnBehalfOfOwner(vendor: {
    hasValidFidelityFundCertificate: boolean;
    hasTrustAccount: boolean;
  }): boolean;
}
