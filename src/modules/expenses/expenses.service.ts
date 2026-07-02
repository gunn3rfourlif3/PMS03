import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { Expense } from './expense.entity';

export interface RecordExpenseInput {
  category: string;
  amount: number;
  incurredOn: string; // 'YYYY-MM-DD'
  propertyId?: string;
  unitId?: string;
  ownerId?: string;
  ownerBillable?: boolean;
  vendorBillRef?: string;
  documentId?: string;
}

/**
 * Records property expenses and posts them to the ledger:
 *   Dr Property Expense / Cr Bank
 *
 * Owner-billable expenses are later recovered from the owner in the owner
 * statement (which nets them out of expense and reduces the owner payout).
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
  ) {}

  async record(input: RecordExpenseInput): Promise<Expense> {
    const [expenseAcc, bank] = await Promise.all([
      this.accounting.resolveAccount('PROPERTY_EXPENSE'),
      this.accounting.resolveAccount('BANK'),
    ]);
    const txnId = await this.ledger.post({
      lines: [
        { accountId: expenseAcc.id, debit: input.amount, entityRef: input.propertyId ? `property:${input.propertyId}` : undefined },
        { accountId: bank.id, credit: input.amount },
      ],
    });

    const repo = this.tenant.getRepository(Expense);
    const expense = await repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        category: input.category,
        amount: input.amount,
        incurredOn: input.incurredOn,
        propertyId: input.propertyId,
        unitId: input.unitId,
        ownerId: input.ownerId,
        ownerBillable: input.ownerBillable ?? false,
        vendorBillRef: input.vendorBillRef,
        documentId: input.documentId,
        status: 'recorded',
        ledgerTxnId: txnId,
      }),
    );
    this.logger.debug(`Expense ${expense.id} recorded (${input.amount}) txn ${txnId}`);
    return expense;
  }

  listForOwner(ownerId: string): Promise<Expense[]> {
    return this.tenant.getRepository(Expense).find({ where: { ownerId } });
  }

  /** Unreimbursed owner-billable expenses for an owner in a 'YYYY-MM' period. */
  ownerBillableForPeriod(ownerId: string, period: string): Promise<Expense[]> {
    return this.tenant
      .getRepository(Expense)
      .createQueryBuilder('e')
      .where('e.owner_id = :ownerId', { ownerId })
      .andWhere('e.owner_billable = true')
      .andWhere("e.status = 'recorded'")
      .andWhere("to_char(e.incurred_on, 'YYYY-MM') = :period", { period })
      .getMany();
  }

  /** Mark expenses reimbursed once folded into a finalized owner statement. */
  async markReimbursed(expenseIds: string[], statementId: string): Promise<void> {
    if (expenseIds.length === 0) return;
    const repo = this.tenant.getRepository(Expense);
    await repo
      .createQueryBuilder()
      .update(Expense)
      .set({ status: 'reimbursed', statementId })
      .whereInIds(expenseIds)
      .execute();
  }
}
