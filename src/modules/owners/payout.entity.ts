import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type PayoutStatus = 'scheduled' | 'paid' | 'failed';

/** A disbursement of a finalized statement's net to the owner. */
@Entity('payouts')
export class Payout extends ImmutableTenantEntity {
  @Column('uuid', { name: 'owner_id' }) ownerId: string;
  @Column('uuid', { name: 'statement_id' }) statementId: string;
  @Column('numeric') amount: number;
  @Index({ unique: true }) @Column({ name: 'gateway_ref' }) gatewayRef: string;
  @Index() @Column({ type: 'text', default: 'scheduled' }) status: PayoutStatus;
  @Column('uuid', { name: 'ledger_txn_id', nullable: true }) ledgerTxnId?: string;
}
