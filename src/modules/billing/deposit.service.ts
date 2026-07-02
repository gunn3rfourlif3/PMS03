import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { Deposit } from './deposit.entity';
import { computeDepositReturn } from './deposit-calc';

/**
 * Deposit lifecycle with trust-account accounting (ZA RHA / PPRA).
 *
 *  capture:  money into trust  -> Dr Trust Bank / Cr Tenant Deposits (trust)
 *  accrue:   interest to tenant-> Dr Trust Bank / Cr Tenant Deposits (trust)
 *  return:   refund + withhold -> Dr Tenant Deposits (trust) / Cr Trust Bank (refund)
 *                                 + Cr income for lawful deductions
 *
 * Deposit money is never commingled with operating funds — a distinct trust
 * bank + trust liability pair keeps segregation provable.
 */
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
  ) {}

  async capture(leaseId: string, amount: number, heldIn = 'trust:default'): Promise<Deposit> {
    const [trustBank, trustLiab] = await Promise.all([
      this.accounting.resolveAccount('TRUST_BANK'),
      this.accounting.resolveAccount('DEPOSIT_TRUST'),
    ]);
    const txnId = await this.ledger.post({
      lines: [
        { accountId: trustBank.id, debit: amount, entityRef: `lease:${leaseId}` },
        { accountId: trustLiab.id, credit: amount, entityRef: `lease:${leaseId}` },
      ],
    });

    const repo = this.tenant.getRepository(Deposit);
    const deposit = await repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        leaseId,
        amount,
        heldIn,
        status: 'held',
        proofSentAt: new Date(), // RHA: written proof within 14 days
      }),
    );
    this.logger.debug(`Deposit ${deposit.id} captured to trust, txn ${txnId}`);
    return deposit;
  }

  /** Periodic interest accrual owed to the tenant. */
  async accrueInterest(depositId: string, interest: number): Promise<Deposit> {
    const repo = this.tenant.getRepository(Deposit);
    const deposit = await repo.findOne({ where: { id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found');

    const [trustBank, trustLiab] = await Promise.all([
      this.accounting.resolveAccount('TRUST_BANK'),
      this.accounting.resolveAccount('DEPOSIT_TRUST'),
    ]);
    await this.ledger.post({
      lines: [
        { accountId: trustBank.id, debit: interest, entityRef: `deposit:${depositId}` },
        { accountId: trustLiab.id, credit: interest, entityRef: `deposit:${depositId}` },
      ],
    });
    deposit.interestAccrued = Number(deposit.interestAccrued) + interest;
    return repo.save(deposit);
  }

  /** Move-out settlement: refund tenant, keep lawful deductions. */
  async returnDeposit(depositId: string, deductions: number[] = []): Promise<Deposit> {
    const repo = this.tenant.getRepository(Deposit);
    const deposit = await repo.findOne({ where: { id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found');

    const { refund, withheld, status } = computeDepositReturn(
      Number(deposit.amount),
      Number(deposit.interestAccrued),
      deductions,
    );

    const [trustBank, trustLiab, income] = await Promise.all([
      this.accounting.resolveAccount('TRUST_BANK'),
      this.accounting.resolveAccount('DEPOSIT_TRUST'),
      this.accounting.resolveAccount('RENTAL_INCOME'), // deductions recovered as income
    ]);

    const owed = Number(deposit.amount) + Number(deposit.interestAccrued);
    const lines = [
      { accountId: trustLiab.id, debit: owed, entityRef: `deposit:${depositId}` },
    ] as { accountId: string; debit?: number; credit?: number; entityRef?: string }[];
    if (refund > 0) lines.push({ accountId: trustBank.id, credit: refund });
    if (withheld > 0) lines.push({ accountId: income.id, credit: withheld });

    const txnId = await this.ledger.post({ lines });

    deposit.deductions = deductions.map((d) => ({ amount: d }));
    deposit.status = status;
    const saved = await repo.save(deposit);
    this.logger.debug(`Deposit ${depositId} ${status}: refund ${refund}, withheld ${withheld}, txn ${txnId}`);
    return saved;
  }
}
