import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'assigned' | 'resolved' | 'closed';

/** A tenant-reported maintenance request against a unit. */
@Entity('tickets')
@Index(['vendorId', 'unitId'])
export class Ticket extends TenantEntity {
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @Column('uuid', { name: 'reporter_id', nullable: true }) reporterId?: string;
  @Column() category: string;
  @Column({ type: 'text', default: 'medium' }) priority: TicketPriority;
  @Column({ type: 'text' }) description: string;
  @Column('jsonb', { default: [] }) media: string[];
  @Index() @Column({ type: 'text', default: 'open' }) status: TicketStatus;
}
