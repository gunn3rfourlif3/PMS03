import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { PAYOUT_PROVIDER } from '@providers/payment/payment-provider.interface';
import type { PaymentProvider } from '@providers/payment/payment-provider.interface';
import { ExpensesService } from '@modules/expenses/expenses.service';
import { Owner } from './owner.entity';
import { OwnerStatement } from './owner-statement.entity';
import { Payout } from './payout.entity';
import { computeStatement } from './statement-calc';

/**
 * Owner statements + split payouts. generate() reclassifies the ledger:
 *   Dr Rental Income (gross) / Cr Mgmt Fee (fee) / Cr Owner Payable (net) /
 *   Cr Expense Recovery (owner-billable expenses). payout() disburses via the
 *   provider and clears Dr Owner Payable / Cr Bank. PPRA: owner money moves
 *   separately from the platform fee.
 */
@Injectable()
export class OwnerStatementService {
  private readonly logger = new Logger(OwnerStatementService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
    private readonly expenses: ExpensesService,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Sum of succeeded payments for the owner's leases in the given period. */
  private async grossCollected(ownerId: string, period: string): Promise<number> {
    const rows = await this.tenant.getManager().query(
      `
      SELECT COALESCE(SUM(p.amount), 0) AS gross
      FROM payments p
      JOIN invoices i ON i.id = (p.allocation->0->>'invoiceId')::uuid
      JOIN leases l   ON l.id = i.lease_id
      JOIN units u    ON u.id = l.unit_id
      JOIN properties pr ON pr.id = u.property_id
      WHERE p.status = 'succeeded'
        AND i.period = $1
        AND pr.owner_id = $2
      `,
      [period, ownerId],
    );
    return Number(rows[0]?.gross ?? 0);
  }

  /** Statement history for an owner, newest first. */
  listForOwner(ownerId: string): Promise<OwnerStatement[]> {
    return this.tenant.getRepository(OwnerStatement).find({ where: { ownerId }, order: { period: 'DESC' } });
  }

  async generate(ownerId: string, period: string): Promise<OwnerStatement> {
    const owners = this.tenant.getRepository(Owner);
    const owner = await owners.findOne({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

    const gross = await this.grossCollected(ownerId, period);

    const billable = await this.expenses.ownerBillableForPeriod(ownerId, period);
    const expensesTotal = billable.reduce((s, e) => s + Number(e.amount), 0);

    const figures = computeStatement(gross, Number(owner.managementFeePct), expensesTotal);

    let txnId: string | undefined;
    if (figures.grossCollected > 0) {
      const [rental, feeIncome, ownerPayable, expenseRecovery] = await Promise.all([
        this.accounting.resolveAccount('RENTAL_INCOME'),
        this.accounting.resolveAccount('MANAGEMENT_FEE_INCOME'),
        this.accounting.resolveAccount('OWNER_PAYABLE'),
        this.accounting.resolveAccount('EXPENSE_RECOVERY'),
      ]);
      const lines = [
        { accountId: rental.id, debit: figures.grossCollected, entityRef: `owner:${ownerId}` },
        { accountId: feeIncome.id, credit: figures.managementFee },
        { accountId: ownerPayable.id, credit: figures.netPayout, entityRef: `owner:${ownerId}` },
      ] as { accountId: string; debit?: number; credit?: number; entityRef?: string }[];
      if (figures.expenses > 0) {
        lines.push({ accountId: expenseRecovery.id, credit: figures.expenses });
      }
      txnId = await this.ledger.post({ lines });
    }

    const repo = this.tenant.getRepository(OwnerStatement);
    const statement = await repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        ownerId,
        period,
        grossCollected: figures.grossCollected,
        managementFee: figures.managementFee,
        expenses: figures.expenses,
        netPayout: figures.netPayout,
        status: 'finalized',
        ledgerTxnId: txnId,
      }),
    );

    await this.expenses.markReimbursed(billable.map((e) => e.id), statement.id);
    return statement;
  }

  async payout(statementId: string): Promise<Payout> {
    const statements = this.tenant.getRepository(OwnerStatement);
    const statement = await statements.findOne({ where: { id: statementId } });
    if (!statement) throw new NotFoundException('Statement not found');
    if (statement.status === 'paid_out') {
      throw new NotFoundException('Statement already paid out');
    }

    const owner = await this.tenant.getRepository(Owner).findOne({
      where: { id: statement.ownerId },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    // Payouts go to the owner's captured bank account. Refuse if it's missing.
    const banking = (owner.banking ?? {}) as {
      bankName?: string; accountHolder?: string; accountNumber?: string; branchCode?: string; accountType?: string;
    };
    if (!banking.accountNumber) {
      throw new BadRequestException("Add this owner's banking details before paying out.");
    }

    const result = await this.provider.payout({
      vendorId: this.tenant.vendorId ?? '',
      ownerId: owner.id,
      amount: Number(statement.netPayout),
      currency: 'ZAR',
      bankAccount: {
        bankName: banking.bankName,
        accountHolder: banking.accountHolder,
        accountNumber: banking.accountNumber,
        branchCode: banking.branchCode,
        accountType: banking.accountType,
      },
    });
    this.logger.debug(`Paying owner ${owner.id} to ${banking.bankName ?? 'bank'} ****${String(banking.accountNumber).slice(-4)}`);

    const [ownerPayable, bank] = await Promise.all([
      this.accounting.resolveAccount('OWNER_PAYABLE'),
      this.accounting.resolveAccount('BANK'),
    ]);
    const txnId = await this.ledger.post({
      lines: [
        { accountId: ownerPayable.id, debit: Number(statement.netPayout), entityRef: `owner:${owner.id}` },
        { accountId: bank.id, credit: Number(statement.netPayout) },
      ],
    });

    const payouts = this.tenant.getRepository(Payout);
    const payout = await payouts.save(
      payouts.create({
        vendorId: this.tenant.vendorId ?? undefined,
        ownerId: owner.id,
        statementId: statement.id,
        amount: Number(statement.netPayout),
        gatewayRef: result.providerRef ?? randomUUID(),
        status: result.status === 'paid' ? 'paid' : 'scheduled',
        ledgerTxnId: txnId,
      }),
    );

    statement.status = 'paid_out';
    await statements.save(statement);
    this.logger.debug(`Owner ${owner.id} paid out ${statement.netPayout} (payout ${payout.id})`);
    return payout;
  }
}
