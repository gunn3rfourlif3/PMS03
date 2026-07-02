import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type LeaseType = 'fixed' | 'month_to_month' | 'co_living';
export type LeaseStatus = 'draft' | 'active' | 'ending' | 'ended' | 'terminated';

@Entity('leases')
export class Lease extends TenantEntity {
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @Column('uuid', { name: 'tenant_id', nullable: true }) tenantId?: string;
  @Column({ type: 'text', default: 'fixed' }) type: LeaseType;
  @Index() @Column({ type: 'text', default: 'draft' }) status: LeaseStatus;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate?: string;
  @Column('numeric', { name: 'rent_amount' }) rentAmount: number;
  @Column({ name: 'billing_cycle', default: 'monthly' }) billingCycle: string;
  @Column('jsonb', { default: {} }) escalation: Record<string, unknown>;
}
