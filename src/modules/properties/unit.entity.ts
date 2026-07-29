import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type UnitStatus =
  | 'vacant' | 'occupied' | 'maintenance' | 'reserved' | 'offline';

@Entity('units')
export class Unit extends TenantEntity {
  @Column('uuid', { name: 'property_id' }) propertyId: string;
  @Column() label: string;

  // Filterable -> typed + indexed (NOT in jsonb).
  @Index() @Column({ type: 'text', default: 'vacant' }) status: UnitStatus;
  @Index() @Column('numeric', { name: 'market_rent', default: 0 }) marketRent: number;

  @Column('int', { default: 0 }) bedrooms: number;
  @Column('int', { default: 0 }) bathrooms: number;
  /** Floor area in square metres (optional). */
  @Column('numeric', { name: 'size_sqm', nullable: true }) sizeSqm?: number;
  @Column('jsonb', { default: {} }) attributes: Record<string, unknown>;
}
