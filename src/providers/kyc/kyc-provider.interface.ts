/**
 * KYC/KYB verification abstraction. The default is a MANUAL provider (a human
 * admin reviews the uploaded documents) — it returns an inconclusive result that
 * flags "manual review required". A real automated provider (Smile ID, Ozow
 * verify, CIPC lookup, sanctions/PEP screening) can be dropped in later with no
 * schema change; its results are stashed on the application's `risk` field for
 * the admin to see, and the admin still makes the final call.
 */
export interface KycCheckResult {
  mode: 'manual' | 'auto';
  passed: boolean | null; // null = inconclusive / needs human review
  score: number | null;   // 0..1 when an automated provider gives one
  findings: string[];     // human-readable notes / flags
}

export interface IndividualCheckInput {
  fullName?: string;
  idType?: string;
  idNumber?: string;
  dob?: string;
}

export interface BusinessCheckInput {
  companyName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  directors?: Array<{ name?: string; idNumber?: string }>;
}

export interface KycProvider {
  readonly name: string;
  verifyIndividual(input: IndividualCheckInput): Promise<KycCheckResult>;
  verifyBusiness(input: BusinessCheckInput): Promise<KycCheckResult>;
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
