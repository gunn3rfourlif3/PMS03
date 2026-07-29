import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';
import { CommissionType } from './agent.entity';

export type ReferralType = 'property' | 'tenant';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

/** A commission a agent has earned for a referral, with its pending->approved->paid lifecycle. */
@Entity('agent_commissions')
@Index(['vendorId', 'status'])
export class AgentCommission extends TenantEntity {
  @Index() @Column('uuid', { name: 'agent_id' }) agentId: string;
  @Column({ type: 'text' }) type: ReferralType;
  @Column({ name: 'source_label' }) sourceLabel: string;   // e.g. the property or tenant referred
  @Column({ type: 'text', default: 'flat' }) basis: CommissionType;
  @Column('numeric') amount: number;
  @Index() @Column({ type: 'text', default: 'pending' }) status: CommissionStatus;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt?: Date;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt?: Date;
  @Column({ name: 'paid_ref', nullable: true }) paidRef?: string;
  @Column({ nullable: true }) note?: string;
  @Column('uuid', { name: 'created_by', nullable: true }) createdBy?: string;
}
