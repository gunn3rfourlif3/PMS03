import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type PropertyType = 'building' | 'complex' | 'single_unit' | 'co_living';

@Entity('properties')
export class Property extends TenantEntity {
  @Column() name: string;
  @Column('jsonb', { nullable: true }) address: Record<string, unknown>;
  @Column({ type: 'text' }) type: PropertyType;
  @Column('uuid', { name: 'owner_id', nullable: true }) ownerId?: string;

  // Flexible metadata ONLY. Filterable fields stay typed columns (see spec A/Part4).
  @Column('jsonb', { default: {} }) attributes: Record<string, unknown>;
}
