import { Entity, Column, Index } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type StatementStatus = 'draft' | 'finalized' | 'paid_out';

/**
 * Monthly owner statement: what the agency collected on the owner's behalf,
 * less the management fee (and owner-billable expenses, when that lands), = the
 * net payout owed. Append-only record; `status` advances draft -> finalized ->
 * paid_out.
 */
@Entity('owner_statements')
@Index(['vendorId', 'ownerId', 'period'], { unique: true })
export class OwnerStatement extends ImmutableTenantEntity {
  @Column('uuid', { name: 'owner_id' }) ownerId: string;
  @Column() period: string; // 'YYYY-MM'
  @Column('numeric', { name: 'gross_collected', default: 0 }) grossCollected: number;
  @Column('numeric', { name: 'management_fee', default: 0 }) managementFee: number;
  @Column('numeric', { default: 0 }) expenses: number;
  @Column('numeric', { name: 'net_payout', default: 0 }) netPayout: number;
  @Index() @Column({ type: 'text', default: 'draft' }) status: StatementStatus;
  @Column('uuid', { name: 'ledger_txn_id', nullable: true }) ledgerTxnId?: string;
}
