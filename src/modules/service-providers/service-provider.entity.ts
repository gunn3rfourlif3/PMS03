import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

/** A vendor's approved service provider / contractor. */
@Entity('service_providers')
@Index(['vendorId', 'category'])
export class ServiceProvider extends TenantEntity {
  @Column() name: string;
  @Column({ type: 'text' }) category: string; // maintenance, landscaping, cleaning, legal, security, ...
  @Column({ name: 'contact_name', nullable: true }) contactName?: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ nullable: true }) email?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @Index() @Column({ type: 'text', default: 'active' }) status: string; // active | inactive
}
