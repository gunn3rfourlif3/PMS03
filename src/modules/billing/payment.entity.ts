import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';
export type PaymentMethod = 'eft' | 'card';

export interface PaymentAllocation {
  invoiceId: string;
  amount: number;
}

/**
 * A tenant payment. Append-only record; amount is write-once. `status`
 * transitions pending -> succeeded/failed as the gateway confirms. A refund is
 * a NEW payment/ledger reversal, never an edit of this row.
 */
@Entity('payments')
export class Payment extends ImmutableTenantEntity {
  @Column('uuid', { name: 'tenant_id', nullable: true }) tenantId?: string;
  @Column('numeric') amount: number;
  @Column({ type: 'text', default: 'eft' }) method: PaymentMethod;
  @Index({ unique: true }) @Column({ name: 'gateway_ref' }) gatewayRef: string;
  @Index() @Column({ type: 'text', default: 'pending' }) status: PaymentStatus;
  @Column({ name: 'received_at', type: 'timestamptz', nullable: true }) receivedAt?: Date;
  @Column('jsonb', { default: [] }) allocation: PaymentAllocation[];
  @Column('uuid', { name: 'ledger_txn_id', nullable: true }) ledgerTxnId?: string;
}
