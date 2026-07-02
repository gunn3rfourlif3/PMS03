import { ZaVatTaxProfile } from '../src/providers/policy/za/za-vat.tax';
import { ZaRhaDepositPolicy } from '../src/providers/policy/za/za-rha.deposit';
import { ZaPpraCompliancePolicy } from '../src/providers/policy/za/za-ppra.compliance';

describe('ZA policy layer', () => {
  it('computes 15% VAT', () => {
    expect(new ZaVatTaxProfile().computeTax(1000)).toBe(150);
  });

  it('exposes RHA deposit return windows (7/14/21)', () => {
    const days = new ZaRhaDepositPolicy().returnWindows().map((w) => w.days);
    expect(days).toEqual([7, 14, 21]);
  });

  it('PPRA blocks rent collection without FFC + trust account', () => {
    const p = new ZaPpraCompliancePolicy();
    expect(p.canCollectOnBehalfOfOwner({ hasValidFidelityFundCertificate: true, hasTrustAccount: true })).toBe(true);
    expect(p.canCollectOnBehalfOfOwner({ hasValidFidelityFundCertificate: false, hasTrustAccount: true })).toBe(false);
  });
});
