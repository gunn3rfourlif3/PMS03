import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';
import { Channel } from '@providers/notification/notification-provider.interface';

/** Per-user notification preferences (channel opt-outs + quiet hours). */
@Entity('notification_preferences')
@Index(['vendorId', 'userId'], { unique: true })
export class NotificationPreference extends TenantEntity {
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column('jsonb', { name: 'opted_out', default: [] }) optedOut: Channel[];
  @Column('jsonb', { name: 'quiet_hours', nullable: true })
  quietHours?: { startHour: number; endHour: number };
}
