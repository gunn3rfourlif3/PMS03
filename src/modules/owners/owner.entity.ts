import { Entity, Column } from 'typeorm';
import { TenantEntity } from '@common/base.entity';
import { encryptedJson } from '@common/security/pii-crypto';

/**
 * A property owner an agency manages on behalf of. (A single landlord is both
 * Vendor and Owner.) `payoutSubaccount` is the provider subaccount used for
 * split payouts (e.g. Paystack). `managementFeePct` is the agency's cut.
 */
@Entity('owners')
export class Owner extends TenantEntity {
  @Column() name: string;
  @Column('jsonb', { default: {} }) contact: Record<string, unknown>;
  @Column({ name: 'payout_subaccount', nullable: true }) payoutSubaccount?: string;
  @Column('numeric', { name: 'management_fee_pct', default: 0 }) managementFeePct: number;
  @Column('jsonb', { default: {}, transformer: encryptedJson }) banking: Record<string, unknown>;
  @Column('uuid', { name: 'user_id', nullable: true }) userId?: string;
}
