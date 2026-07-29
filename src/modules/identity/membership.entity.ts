import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type Role =
  | 'platform_admin' | 'vendor_owner' | 'property_manager' | 'tenant' | 'contractor' | 'owner' | 'partner';

@Entity('memberships')
@Index(['vendorId', 'userId'], { unique: true })
export class Membership extends TenantEntity {
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column({ type: 'text' }) role: Role;
  // e.g. { properties: [uuid], permissions: ['billing:read'] }
  @Column('jsonb', { default: {} }) scope: Record<string, unknown>;
}
