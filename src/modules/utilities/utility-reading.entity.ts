import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

/** Manual for now. The others are named so the column never needs widening. */
export type UtilityReadingSource = 'manual' | 'import' | 'device';

/**
 * One capture against a meter — see docs/LOCARE_UTILITIES_BUILD_PLAN.md.
 *
 * `reading` is the dial value as found, and is what the capturer typed.
 * `consumption` is DERIVED server-side from the previous reading on the same
 * meter and is never accepted from the client; it is stored rather than computed
 * on read so that correcting an older reading cannot silently restate a period
 * that has already been reported on.
 *
 * For an unmetered point (sewerage, refuse) both are null and only `cost`
 * carries meaning.
 */
@Entity('utility_readings')
@Index(['vendorId', 'meterId', 'readingDate'])
export class UtilityReading extends TenantEntity {
  @Column('uuid', { name: 'meter_id' }) meterId: string;

  @Column({ name: 'reading_date', type: 'date' }) readingDate: string;

  /** The dial value as found. Null for an unmetered point. */
  @Column('numeric', { nullable: true }) reading?: number | null;

  /** Derived: (reading - previous) * multiplier, or the wrap when rolled over. */
  @Column('numeric', { nullable: true }) consumption?: number | null;

  /**
   * The meter wrapped past its last digit. Set by the capturer, because the
   * alternative — inferring it from a lower reading — cannot tell a rollover
   * from a typo, and guessing wrong either doubles a bill or hides a leak.
   */
  @Column({ default: false }) rollover: boolean;

  /** No physical read was taken; the value is an estimate and is marked as one. */
  @Column({ default: false }) estimated: boolean;

  /** Rand per unit of measure, as billed for this period. Null when unknown. */
  @Column('numeric', { name: 'tariff_rate', nullable: true }) tariffRate?: number | null;

  /** What the municipality charged for this period, in rands. */
  @Column('numeric', { nullable: true }) cost?: number | null;

  @Column({ type: 'text', default: 'manual' }) source: UtilityReadingSource;

  /** Who captured it. Kept for the "who typed this" question a dispute raises. */
  @Column('uuid', { name: 'captured_by_user_id', nullable: true }) capturedByUserId?: string | null;

  /** Photographs of the dial, as media keys. */
  @Column('jsonb', { default: [] }) media: string[];

  @Column({ type: 'text', nullable: true }) note?: string | null;
}
