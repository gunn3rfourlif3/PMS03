import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type SubInvoiceStatus = 'issued' | 'paid' | 'void';

/** A monthly platform-subscription bill for an agency. Platform-scoped (no RLS). */
@Entity('subscription_invoices')
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid', { name: 'vendor_id' }) vendorId: string;
  @Column({ type: 'text' }) period: string;
  @Column({ type: 'text' }) tier: string;
  @Column('int', { name: 'unit_count', default: 0 }) unitCount: number;
  @Column('numeric', { default: 0 }) amount: number;
  @Column({ type: 'text', default: 'issued' }) status: SubInvoiceStatus;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate?: string;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt?: Date;
  @Column({ name: 'paid_ref', type: 'text', nullable: true }) paidRef?: string;
  @Column({ name: 'gateway_ref', type: 'text', nullable: true }) gatewayRef?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
