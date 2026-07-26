import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ProofStatus = 'pending' | 'accepted' | 'rejected';

/** A tenant-submitted proof of an off-gateway (e.g. EFT) payment for an invoice. */
@Entity('proof_of_payments')
@Index(['vendorId', 'status'])
export class ProofOfPayment extends TenantEntity {
  @Column('uuid', { name: 'invoice_id' }) invoiceId: string;
  @Column('uuid', { name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'file_url' }) fileUrl: string;
  @Column('numeric', { nullable: true }) amount?: number;
  @Column({ name: 'paid_at', type: 'date', nullable: true }) paidAt?: string;
  @Column({ nullable: true }) reference?: string;
  @Column({ nullable: true }) note?: string;
  @Index() @Column({ type: 'text', default: 'pending' }) status: ProofStatus;
  @Column({ name: 'review_note', nullable: true }) reviewNote?: string;
  @Column('uuid', { name: 'reviewed_by', nullable: true }) reviewedBy?: string;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt?: Date;
}
