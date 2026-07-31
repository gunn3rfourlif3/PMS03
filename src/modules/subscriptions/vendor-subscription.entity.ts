import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SubscriptionTier = 'starter' | 'growth' | 'scale' | 'enterprise';
export type SubscriptionStatus = 'pending' | 'trialing' | 'active' | 'past_due' | 'cancelled';

/**
 * A vendor's (agency's) software subscription. PLATFORM-SCOPED — no vendor RLS,
 * so this is a plain entity (not TenantEntity). App-layer code always scopes by
 * vendorId.
 */
@Entity('vendor_subscriptions')
export class VendorSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column('uuid', { name: 'vendor_id' }) vendorId: string;
  @Column({ type: 'text', default: 'starter' }) tier: SubscriptionTier;
  @Column({ type: 'text', default: 'active' }) status: SubscriptionStatus;
  @Column('int', { name: 'unit_count', default: 0 }) unitCount: number;
  @Column('numeric', { default: 0 }) mrr: number;
  @Column('uuid', { name: 'referred_by_partner_id', nullable: true }) referredByPartnerId?: string;
  @Column({ name: 'current_period', type: 'text', nullable: true }) currentPeriod?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
