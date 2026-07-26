import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type LeaseAgreementStatus = 'sent' | 'signed' | 'declined' | 'void';

/** A generated lease agreement issued to a tenant for electronic signature. */
@Entity('lease_agreements')
@Index(['vendorId', 'status'])
export class LeaseAgreement extends TenantEntity {
  @Column('uuid', { name: 'lease_id' }) leaseId: string;
  @Column('uuid', { name: 'tenant_id' }) tenantId: string;
  @Index({ unique: true }) @Column() ref: string;
  @Column({ name: 'file_url' }) fileUrl: string;
  @Column('jsonb', { name: 'render_data', default: {} }) renderData: Record<string, unknown>;
  @Index() @Column({ type: 'text', default: 'sent' }) status: LeaseAgreementStatus;
  @Column({ name: 'signer_name', nullable: true }) signerName?: string;
  @Column({ name: 'signer_ip', nullable: true }) signerIp?: string;
  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true }) signedAt?: Date;
}
