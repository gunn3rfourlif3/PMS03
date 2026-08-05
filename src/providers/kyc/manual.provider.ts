import { Injectable } from '@nestjs/common';
import { BusinessCheckInput, IndividualCheckInput, KycCheckResult, KycProvider } from './kyc-provider.interface';

/** Default: no automated checks — a platform admin reviews the documents by hand. */
@Injectable()
export class ManualKycProvider implements KycProvider {
  readonly name = 'manual';
  private readonly result: KycCheckResult = { mode: 'manual', passed: null, score: null, findings: ['Manual review required'] };
  async verifyIndividual(_input: IndividualCheckInput): Promise<KycCheckResult> { return this.result; }
  async verifyBusiness(_input: BusinessCheckInput): Promise<KycCheckResult> { return this.result; }
}
