import { Injectable } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Account, AccountType } from './account.entity';

/** Standard chart-of-accounts codes used by the billing flows. */
export const STD_ACCOUNTS: Record<
  string,
  { code: string; name: string; type: AccountType; isTrust?: boolean }
> = {
  BANK: { code: '1100', name: 'Bank (operating)', type: 'asset' },
  TRUST_BANK: { code: '1200', name: 'Trust Bank (segregated)', type: 'asset', isTrust: true },
  ACCOUNTS_RECEIVABLE: { code: '1000', name: 'Accounts Receivable', type: 'asset' },
  RENTAL_INCOME: { code: '4000', name: 'Rental Income', type: 'income' },
  LATE_FEE_INCOME: { code: '4100', name: 'Late Fee Income', type: 'income' },
  MANAGEMENT_FEE_INCOME: { code: '4200', name: 'Management Fee Income', type: 'income' },
  EXPENSE_RECOVERY: { code: '4300', name: 'Expense Recovery (contra)', type: 'income' },
  VAT_OUTPUT: { code: '2100', name: 'VAT Output (payable)', type: 'liability' },
  OWNER_PAYABLE: { code: '2300', name: 'Owner Payable', type: 'liability' },
  PROPERTY_EXPENSE: { code: '5000', name: 'Property Expense', type: 'expense' },
  DEPOSIT_TRUST: {
    code: '2200',
    name: 'Tenant Deposits (trust)',
    type: 'liability',
    isTrust: true,
  },
};

@Injectable()
export class AccountingService {
  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Accounting module ready';
  }

  /**
   * Resolve a standard account for the current vendor, creating it on first use
   * (idempotent get-or-create).
   */
  async resolveAccount(key: keyof typeof STD_ACCOUNTS): Promise<Account> {
    const def = STD_ACCOUNTS[key];
    const repo = this.tenant.getRepository(Account);
    const existing = await repo.findOne({ where: { code: def.code } });
    if (existing) return existing;
    return repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        code: def.code,
        name: def.name,
        type: def.type,
        isTrust: def.isTrust ?? false,
      }),
    );
  }
}
