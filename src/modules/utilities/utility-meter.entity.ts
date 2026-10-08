import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

/**
 * What the municipality bills for. Three metered services and two that are not.
 * Sewerage and refuse appear on the same municipal account and agencies recover
 * them the same way, so they live here rather than in a parallel table that
 * would split a sheet the clerk fills in as one.
 */
export type UtilityKind = 'electricity' | 'water' | 'gas' | 'sewerage' | 'refuse';

/** kWh for electricity, kL for water, m3 for gas; `fixed` for the unmetered two. */
export type UtilityUom = 'kWh' | 'kL' | 'm3' | 'fixed';

export type UtilityMeterStatus = 'active' | 'removed';

/**
 * A metering or charge point — see docs/LOCARE_UTILITIES_BUILD_PLAN.md.
 *
 * Attached to EITHER a unit (a submeter, recovered from that tenant) OR a
 * property (the bulk municipal meter for the building). Exactly one, enforced by
 * a CHECK in the migration: a meter that belongs to both is a meter nobody can
 * reconcile, and the recovery gap — bulk minus the sum of its submeters — is the
 * whole reason both exist.
 */
@Entity('utility_meters')
@Index(['vendorId', 'propertyId'])
@Index(['vendorId', 'unitId'])
export class UtilityMeter extends TenantEntity {
  /** Set for a bulk meter. Null for a submeter — reach the property via the unit. */
  @Column('uuid', { name: 'property_id', nullable: true }) propertyId?: string | null;

  /** Set for a submeter. Null for a bulk meter. */
  @Column('uuid', { name: 'unit_id', nullable: true }) unitId?: string | null;

  @Index() @Column({ type: 'text' }) kind: UtilityKind;

  /**
   * False for sewerage and refuse. An unmetered point's readings carry no dial
   * value and no consumption — only the cost the municipality charged for the
   * period.
   */
  @Column({ default: true }) metered: boolean;

  @Column({ name: 'unit_of_measure', type: 'text', default: 'kWh' }) unitOfMeasure: UtilityUom;

  /** Municipal or physical meter number, as printed on the meter. */
  @Column({ type: 'text', nullable: true }) serial?: string | null;

  /** What the clerk calls it on the sheet: "Block B geyser", "Main incomer". */
  @Column({ type: 'text', nullable: true }) label?: string | null;

  /**
   * CT ratio. Large-installation electricity meters display a scaled value and
   * the true consumption is the difference times this. Defaults to 1, which is
   * every domestic meter.
   */
  @Column('numeric', { default: 1 }) multiplier: number;

  /** Number of digits before rollover, for the wrap calculation. Null = unknown. */
  @Column('int', { name: 'dial_digits', nullable: true }) dialDigits?: number | null;

  @Index() @Column({ type: 'text', default: 'active' }) status: UtilityMeterStatus;

  @Column({ type: 'text', nullable: true }) notes?: string | null;
}
