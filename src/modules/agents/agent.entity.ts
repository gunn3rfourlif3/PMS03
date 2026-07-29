import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type AgentStatus = 'active' | 'inactive';
export type CommissionType = 'flat' | 'percent_first_month';

export interface AgentBanking {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
}

/** A referral/introducer partner who earns commission for bringing properties or tenants. */
@Entity('agents')
@Index(['vendorId', 'status'])
export class Agent extends TenantEntity {
  @Column() name: string;
  @Column({ nullable: true }) email?: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ nullable: true }) company?: string;
  @Index() @Column({ type: 'text', default: 'active' }) status: AgentStatus;
  @Column({ name: 'commission_type', type: 'text', default: 'flat' }) commissionType: CommissionType;
  @Column('numeric', { name: 'commission_value', default: 0 }) commissionValue: number; // Rand (flat) or % (percent)
  @Column('jsonb', { default: {} }) banking: AgentBanking;
  @Column({ nullable: true }) notes?: string;
}
