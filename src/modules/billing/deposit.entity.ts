import { Entity, Column } from 'typeorm';
import { ImmutableTenantEntity } from '@common/base.entity';

export type DepositStatus =
  | 'held' | 'partially_returned' | 'returned' | 'forfeited';

/**
 * Security deposit. ZA Rental Housing Act s5(3):
 *  - held in an INTEREST-BEARING trust account
 *  - accrued interest is a LIABILITY OWED TO THE TENANT
 *  - written proof of account + rate to tenant within 14 days
 *  - return within 7 / 14 / 21 days depending on inspection
 * Append-only; status transitions post reversing/settlement ledger entries.
 */
@Entity('deposits')
export class Deposit extends ImmutableTenantEntity {
  @Column('uuid', { name: 'lease_id' }) leaseId: string;
  @Column('numeric') amount: number;

  @Column({ name: 'held_in' }) heldIn: string; // interest-bearing trust account ref
  @Column('numeric', { name: 'interest_accrued', default: 0 })
  interestAccrued: number;
  @Column({ name: 'proof_sent_at', type: 'timestamptz', nullable: true })
  proofSentAt?: Date;

  @Column({ type: 'text', default: 'held' }) status: DepositStatus;
  @Column('jsonb', { default: [] }) deductions: unknown[]; // -> move-out inspection diff
}
