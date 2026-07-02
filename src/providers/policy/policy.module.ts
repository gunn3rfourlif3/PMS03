import { Global, Module } from '@nestjs/common';
import { ZaVatTaxProfile } from './za/za-vat.tax';
import { ZaRhaDepositPolicy } from './za/za-rha.deposit';
import { ZaPpraCompliancePolicy } from './za/za-ppra.compliance';

export const TAX_PROFILE = Symbol('TAX_PROFILE');
export const DEPOSIT_POLICY = Symbol('DEPOSIT_POLICY');
export const COMPLIANCE_POLICY = Symbol('COMPLIANCE_POLICY');

/**
 * Cross-cutting market-policy layer. @Global so TAX_PROFILE / DEPOSIT_POLICY /
 * COMPLIANCE_POLICY are injectable anywhere (e.g. InvoiceService) without each
 * consuming module importing PolicyModule. Binds active policies from env
 * defaults; per-vendor overrides come from vendor.config in a later phase.
 */
@Global()
@Module({
  providers: [
    { provide: TAX_PROFILE, useClass: ZaVatTaxProfile },
    { provide: DEPOSIT_POLICY, useClass: ZaRhaDepositPolicy },
    { provide: COMPLIANCE_POLICY, useClass: ZaPpraCompliancePolicy },
  ],
  exports: [TAX_PROFILE, DEPOSIT_POLICY, COMPLIANCE_POLICY],
})
export class PolicyModule {}
