import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { encryptedJson } from '@common/security/pii-crypto';

export type PartnerApplicationType = 'individual' | 'business';
export type PartnerApplicationStatus =
  | 'draft' | 'submitted' | 'under_review' | 'info_requested' | 'approved' | 'rejected';

export interface ApplicationDocument {
  docType: string;   // id_document | proof_of_address | company_registration | director_id | bank_confirmation | vat_certificate | other
  url: string;
  key?: string;      // storage key (for later physical deletion on retention purge)
  name: string;
  uploadedAt: string;
}

/**
 * A prospective partner's vetting application (KYC for individuals, KYB for
 * businesses). PLATFORM-SCOPED (no vendor RLS). PII (ID numbers, banking) is
 * encrypted at rest via the `encryptedJson` transformer; documents live in
 * private storage and are only linked here by URL. Nothing provisions a real
 * partner until a platform admin approves.
 */
@Entity('partner_applications')
export class PartnerApplication {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) type: PartnerApplicationType;

  @Column({ name: 'contact_name', nullable: true }) contactName?: string;
  @Index() @Column({ name: 'contact_email' }) contactEmail: string;
  @Column({ name: 'contact_phone', nullable: true }) contactPhone?: string;

  // ── Individual (KYC) — non-sensitive ──
  @Column({ name: 'full_name', nullable: true }) fullName?: string;
  @Column({ name: 'id_type', type: 'text', nullable: true }) idType?: 'sa_id' | 'passport';
  @Column({ name: 'residential_address', type: 'text', nullable: true }) residentialAddress?: string;

  // ── Business (KYB) — non-sensitive ──
  @Column({ name: 'company_name', nullable: true }) companyName?: string;
  @Column({ name: 'registration_number', nullable: true }) registrationNumber?: string;
  @Column({ name: 'vat_number', nullable: true }) vatNumber?: string;
  @Column({ name: 'business_address', type: 'text', nullable: true }) businessAddress?: string;

  // ── Encrypted PII ──
  // sensitive: { idNumber?, dob?, directors?: [{ name, idNumber }] }
  @Column('jsonb', { default: {}, transformer: encryptedJson }) sensitive: Record<string, unknown>;
  // banking: { bankName, accountHolder, accountNumber, branchCode, accountType }
  @Column('jsonb', { default: {}, transformer: encryptedJson }) banking: Record<string, unknown>;

  @Column('jsonb', { default: () => "'[]'" }) documents: ApplicationDocument[];
  @Column('jsonb', { default: () => "'{}'" }) risk: Record<string, unknown>;

  @Column({ name: 'agreed_terms', type: 'boolean', default: false }) agreedTerms: boolean;
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true }) consentAt?: Date;

  @Column({ type: 'text', default: 'draft' }) status: PartnerApplicationStatus;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy?: string;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt?: Date;
  @Column({ name: 'decision_reason', type: 'text', nullable: true }) decisionReason?: string;
  @Column({ name: 'risk_notes', type: 'text', nullable: true }) riskNotes?: string;
  @Column({ name: 'partner_id', type: 'uuid', nullable: true }) partnerId?: string;

  // Token (hashed) that authorises the applicant's document uploads + submit
  // without a login, until it expires.
  @Column({ name: 'upload_token_hash', type: 'text', nullable: true }) uploadTokenHash?: string;
  @Column({ name: 'upload_token_expires', type: 'timestamptz', nullable: true }) uploadTokenExpires?: Date;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
