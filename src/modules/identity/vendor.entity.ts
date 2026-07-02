import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type VendorType = 'individual_landlord' | 'agency';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'text', default: 'individual_landlord' }) type: VendorType;
  @Column({ default: 'active' }) status: string;

  // White-label + market policy selection (rules live in code; this selects them).
  @Column('jsonb', { default: {} }) config: Record<string, unknown>;
  @Column({ name: 'default_currency', default: 'ZAR' }) defaultCurrency: string;
  @Column({ name: 'custom_domain', nullable: true }) customDomain?: string;

  // ZA PPRA gate for "collect rent on behalf of owner".
  @Column({ name: 'has_valid_ffc', default: false }) hasValidFidelityFundCertificate: boolean;
  @Column({ name: 'has_trust_account', default: false }) hasTrustAccount: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
