import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from '@common/base.entity';

export type AccountType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';

/**
 * Chart-of-accounts node. Trust accounts (tenant deposits, rent held for
 * owners) are flagged so reporting can prove segregation (ZA PPRA / RHA).
 */
@Entity('accounts')
@Index(['vendorId', 'code'], { unique: true })
export class Account extends TenantEntity {
  @Column() code: string;          // e.g. '1000' AR, '4000' Rental income
  @Column() name: string;
  @Column({ type: 'text' }) type: AccountType;
  @Column({ name: 'is_trust', default: false }) isTrust: boolean;
}
