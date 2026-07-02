import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from 'typeorm';

/**
 * Base for OPERATIONAL, tenant-scoped tables (soft-delete allowed).
 *
 * Immutability model:
 *   - The GENERAL LEDGER (LedgerEntry) is the single immutable source of truth:
 *     never updated or soft-deleted; corrections are reversing entries. It is
 *     the only table with DB-level UPDATE/DELETE blocks.
 *   - Business/financial DOCUMENTS (Invoice, Payment, Deposit, Payout,
 *     OwnerStatement) are append-only records whose monetary amounts are
 *     write-once BY CONVENTION, but whose lifecycle STATUS legitimately
 *     transitions. They extend ImmutableTenantEntity (no soft delete) but
 *     permit status updates, enforced in services not by blocking UPDATE.
 *   - AuditLog is append-only.
 */
export abstract class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'vendor_id' })
  vendorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

/**
 * Base for append-only records: no soft delete. Used by financial documents
 * whose amounts are write-once by convention, and by the ledger + audit log
 * which are additionally UPDATE/DELETE-blocked at the DB.
 */
export abstract class ImmutableTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'vendor_id' })
  vendorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
