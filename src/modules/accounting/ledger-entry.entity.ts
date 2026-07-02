import { Entity, Column } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

/**
 * Double-entry journal line. APPEND-ONLY: never updated or deleted.
 * A financial event posts a balanced set of lines (sum(debit)=sum(credit)).
 * Corrections are made with a NEW reversing set of lines.
 */
@Entity('ledger_entries')
export class LedgerEntry extends ImmutableTenantEntity {
  @Column('uuid', { name: 'transaction_id' }) transactionId: string;
  @Column('uuid', { name: 'account_id' }) accountId: string;
  @Column('numeric', { default: 0 }) debit: number;
  @Column('numeric', { default: 0 }) credit: number;
  @Column({ name: 'entity_ref', nullable: true }) entityRef?: string;
  @Column({ name: 'posted_at', type: 'timestamptz' }) postedAt: Date;
}
