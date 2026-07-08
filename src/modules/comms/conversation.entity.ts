import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ConversationStatus = 'open' | 'closed';

/**
 * A message thread between a tenant and the vendor's staff (managers/owner).
 * One tenant participant; staff are any user with a manager/owner membership,
 * so we track the tenant explicitly and treat the other side as "staff".
 */
@Entity('conversations')
@Index(['vendorId', 'tenantUserId'])
export class Conversation extends TenantEntity {
  @Column() subject: string;
  @Column('uuid', { name: 'tenant_user_id' }) tenantUserId: string;
  @Column('uuid', { name: 'unit_id', nullable: true }) unitId?: string;

  @Index() @Column({ type: 'text', default: 'open' }) status: ConversationStatus;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true }) lastMessageAt?: Date;
  @Column({ name: 'last_message_preview', type: 'text', nullable: true }) lastMessagePreview?: string;

  // Read watermarks per side, for unread counts.
  @Column({ name: 'tenant_last_read_at', type: 'timestamptz', nullable: true }) tenantLastReadAt?: Date;
  @Column({ name: 'staff_last_read_at', type: 'timestamptz', nullable: true }) staffLastReadAt?: Date;
}
