import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ListingStatus = 'draft' | 'published' | 'paused' | 'filled' | 'closed';

/** A vacancy advertised for a unit. Drives the applicant funnel. */
@Entity('listings')
export class Listing extends TenantEntity {
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @Column('numeric', { name: 'advertised_rent' }) advertisedRent: number;
  @Column({ name: 'available_from', type: 'date' }) availableFrom: string;
  @Index() @Column({ type: 'text', default: 'draft' }) status: ListingStatus;
  @Column({ nullable: true }) description?: string;
  @Column('jsonb', { default: [] }) media: unknown[];
}
