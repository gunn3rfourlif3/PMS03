import { CompliancePolicy } from '../policy.interfaces';

/**
 * ZA Property Practitioners Act / PPRA: a vendor collecting rent on behalf of
 * an owner must hold a valid Fidelity Fund Certificate AND a trust account.
 * This gates the "collect on behalf of owner" feature.
 */
export class ZaPpraCompliancePolicy implements CompliancePolicy {
  readonly key = 'ZA_PPRA';
  canCollectOnBehalfOfOwner(vendor: {
    hasValidFidelityFundCertificate: boolean;
    hasTrustAccount: boolean;
  }): boolean {
    return vendor.hasValidFidelityFundCertificate && vendor.hasTrustAccount;
  }
}
