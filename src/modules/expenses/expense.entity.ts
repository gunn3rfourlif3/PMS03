import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type ExpenseStatus = 'recorded' | 'reimbursed';

/**
 * A cost incurred against a property/unit (e.g. a contractor bill). If
 * `ownerBillable`, it is fronted by the agency and recovered from the owner in
 * the next owner statement (reducing net payout). Operational + soft-deletable;
 * `status` advances recorded -> reimbursed when folded into a statement.
 */
@Entity('expenses')
@Index(['vendorId', 'ownerId', 'status'])
export class Expense extends TenantEntity {
  @Column('uuid', { name: 'property_id', nullable: true }) propertyId?: string;
  @Column('uuid', { name: 'unit_id', nullable: true }) unitId?: string;
  @Column('uuid', { name: 'owner_id', nullable: true }) ownerId?: string;
  @Column() category: string;
  @Column('numeric') amount: number;
  @Column({ name: 'vendor_bill_ref', nullable: true }) vendorBillRef?: string;
  @Column({ name: 'owner_billable', default: false }) ownerBillable: boolean;
  @Column({ name: 'incurred_on', type: 'date' }) incurredOn: string; // 'YYYY-MM-DD'
  @Index() @Column({ type: 'text', default: 'recorded' }) status: ExpenseStatus;
  @Column('uuid', { name: 'document_id', nullable: true }) documentId?: string;
  @Column('uuid', { name: 'statement_id', nullable: true }) statementId?: string;
  @Column('uuid', { name: 'ledger_txn_id', nullable: true }) ledgerTxnId?: string;
}
