import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ExtractionStatus = 'parsed' | 'failed' | 'confirmed';

/** A parsed lease document awaiting staff verification before it becomes a lease. */
@Entity('lease_extractions')
@Index(['vendorId', 'status'])
export class LeaseExtractionRecord extends TenantEntity {
  @Column({ name: 'source_url' }) sourceUrl: string;
  @Index() @Column({ type: 'text', default: 'parsed' }) status: ExtractionStatus;
  @Column({ nullable: true }) provider?: string;
  @Column('jsonb', { default: {} }) extracted: Record<string, unknown>;
  @Column('numeric', { nullable: true }) confidence?: number;
  @Column({ type: 'text', nullable: true }) error?: string;
  @Column('uuid', { name: 'created_by', nullable: true }) createdBy?: string;
}
