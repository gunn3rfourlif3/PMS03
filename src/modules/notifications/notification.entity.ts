import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';
import { Channel } from '@providers/notification/notification-provider.interface';

export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed';

/** Delivery log: one row per (recipient, channel, template) attempt. */
@Entity('notifications')
export class Notification extends ImmutableTenantEntity {
  @Column('uuid', { name: 'user_id', nullable: true }) userId?: string;
  @Column({ type: 'text' }) channel: Channel;
  @Column() template: string;
  @Column() destination: string;
  @Column('jsonb', { default: {} }) payload: Record<string, unknown>;
  @Index() @Column({ type: 'text', default: 'queued' }) status: NotificationStatus;
  @Column({ name: 'provider_ref', nullable: true }) providerRef?: string;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt?: Date;
  @Column({ nullable: true }) error?: string;
}
