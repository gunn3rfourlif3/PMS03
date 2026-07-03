import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type WorkOrderStatus = 'assigned' | 'in_progress' | 'completed' | 'invoiced';

/** A unit of work dispatched to a contractor to resolve a ticket. */
@Entity('work_orders')
export class WorkOrder extends TenantEntity {
  @Column('uuid', { name: 'ticket_id' }) ticketId: string;
  @Column('uuid', { name: 'contractor_id', nullable: true }) contractorId?: string;
  @Index() @Column({ type: 'text', default: 'assigned' }) status: WorkOrderStatus;
  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: true }) scheduledFor?: Date;
  @Column('numeric', { nullable: true }) cost?: number;
  @Column({ nullable: true }) notes?: string;
  @Column('uuid', { name: 'expense_id', nullable: true }) expenseId?: string;
}
