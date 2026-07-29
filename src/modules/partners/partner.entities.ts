import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type PartnerStatus = 'pending' | 'active' | 'suspended';

/** A software reseller. PLATFORM-SCOPED (no vendor RLS). */
@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ name: 'contact_email', nullable: true }) contactEmail?: string;
  @Column({ name: 'contact_phone', nullable: true }) contactPhone?: string;
  @Column({ nullable: true }) company?: string;
  @Index({ unique: true }) @Column({ name: 'ref_code' }) refCode: string;
  @Column({ type: 'text', default: 'pending' }) status: PartnerStatus;
  @Column('numeric', { name: 'commission_rate', default: 0.10 }) commissionRate: number;
  @Column('int', { name: 'commission_months', nullable: true }) commissionMonths?: number;
  @Column('jsonb', { default: {} }) banking: Record<string, unknown>;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('partner_members')
export class PartnerMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'partner_id' }) partnerId: string;
  @Index() @Column('uuid', { name: 'user_id' }) userId: string;
  @Column({ type: 'text', default: 'partner_owner' }) role: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

export type DealStage = 'lead' | 'contacted' | 'demo' | 'trial' | 'proposal' | 'won' | 'lost';

@Entity('partner_deals')
export class PartnerDeal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid', { name: 'partner_id' }) partnerId: string;
  @Column({ name: 'prospect_name' }) prospectName: string;
  @Column({ name: 'contact_name', nullable: true }) contactName?: string;
  @Column({ name: 'contact_email', nullable: true }) contactEmail?: string;
  @Column({ name: 'contact_phone', nullable: true }) contactPhone?: string;
  @Column({ type: 'text', default: 'lead' }) stage: DealStage;
  @Column('int', { name: 'expected_units', default: 0 }) expectedUnits: number;
  @Column('numeric', { name: 'expected_mrr', default: 0 }) expectedMrr: number;
  @Column({ type: 'text', default: 'manual' }) source: string;
  @Column({ name: 'lost_reason', type: 'text', nullable: true }) lostReason?: string;
  @Column('uuid', { name: 'vendor_id', nullable: true }) vendorId?: string;
  @Column({ name: 'stage_changed_at', type: 'timestamptz', default: () => 'now()' }) stageChangedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

export type ActivityType = 'call' | 'email' | 'demo' | 'note' | 'stage_change' | 'signup';

@Entity('partner_activities')
export class PartnerActivity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid', { name: 'partner_id' }) partnerId: string;
  @Column('uuid', { name: 'deal_id', nullable: true }) dealId?: string;
  @Column({ type: 'text' }) type: ActivityType;
  @Column({ type: 'text', nullable: true }) summary?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
