import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ListingStatus = 'draft' | 'published' | 'paused' | 'filled' | 'closed';

/** A vacancy advertised for a unit. Drives the applicant funnel. */
@Entity('listings')
export class Listing extends TenantEntity {
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @Column('numeric', { name: 'advertised_rent' }) advertisedRent: number;
  /** Optional security deposit charged on move-in (0 = none). */
  @Column('numeric', { default: 0 }) deposit: number;
  /** Optional one-off admin / lease fee charged on move-in (0 = none). */
  @Column('numeric', { name: 'admin_fee', default: 0 }) adminFee: number;
  @Column({ name: 'available_from', type: 'date' }) availableFrom: string;
  @Index() @Column({ type: 'text', default: 'draft' }) status: ListingStatus;
  @Column({ nullable: true }) description?: string;
  @Column('jsonb', { default: [] }) media: unknown[];
}
