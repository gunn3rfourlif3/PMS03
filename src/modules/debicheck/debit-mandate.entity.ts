import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { encryptedJson } from '@common/security/pii-crypto';
import { MandateState } from './mandate-calc';

/**
 * An authenticated DebiCheck mandate — a first-class entity with its own state
 * machine and audit trail, not a flag on a lease
 * (docs/LOCARE_DEBIT_ORDER_DESIGN.md §4). It outlives individual collections
 * and survives lease renewals via amendment.
 *
 * Tenant-scoped: RLS policy ships in the same migration, per CLAUDE.md.
 */
@Entity('debit_mandates')
export class DebitMandate {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column('uuid', { name: 'vendor_id' }) vendorId: string;
  @Index() @Column('uuid', { name: 'lease_id' }) leaseId: string;
  @Column('uuid', { name: 'tenant_id', nullable: true }) tenantId?: string;

  @Index() @Column({ type: 'text', default: 'drafted' }) state: MandateState;

  /**
   * The bank-enforced maximum. A collection above this is REJECTED outright,
   * not reduced — see §5. Derived from the lease at creation by
   * `mandateCeiling()`, never a flat percentage of opening rent.
   */
  @Column('numeric', { name: 'max_collection_amount' }) maxCollectionAmount: number;

  /** What the ceiling was computed from, so a later breach is explainable. */
  @Column('numeric', { name: 'basis_rent_amount' }) basisRentAmount: number;
  @Column('numeric', { name: 'basis_escalation_pct' }) basisEscalationPct: number;
  /**
   * True when the lease stated no escalation rate and the default was assumed.
   * Worth storing: an assumed rate that turns out low is the most likely cause
   * of a mid-term breach, and this is how you find those mandates.
   */
  @Column({ name: 'basis_escalation_assumed', default: false }) basisEscalationAssumed: boolean;

  @Column('int', { name: 'collection_day', default: 1 }) collectionDay: number;
  /** Lets the bank move a collection off a weekend or public holiday (§11.7). */
  @Column({ name: 'day_adjustment_allowed', default: true }) dayAdjustmentAllowed: boolean;
  @Column({ name: 'first_collection_date', type: 'date', nullable: true }) firstCollectionDate?: string;

  @Index() @Column({ name: 'provider_mandate_ref', type: 'text', nullable: true }) providerMandateRef?: string;
  @Column({ name: 'provider', type: 'text', default: 'stitch' }) provider: string;

  @Column({ name: 'authenticated_at', type: 'timestamptz', nullable: true }) authenticatedAt?: Date;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt?: Date;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true }) cancelledAt?: Date;
  /** Provider's reason on revoke/pause/reject — shown to staff, not just logged. */
  @Column({ name: 'status_reason', type: 'text', nullable: true }) statusReason?: string;

  /**
   * Tenant banking details as supplied to the provider. PII — encrypted at rest
   * via the same transformer as owner banking and partner KYC.
   * ⚠ Rotating PII_ENCRYPTION_KEY makes this unreadable without a
   * decrypt-and-re-encrypt migration.
   */
  @Column('jsonb', { default: {}, transformer: encryptedJson })
  banking: Record<string, unknown>;

  /** Append-only state history: {at, from, to, reason, actor}. */
  @Column('jsonb', { default: [] }) history: Record<string, unknown>[];

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
