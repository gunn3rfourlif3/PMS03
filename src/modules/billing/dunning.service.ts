import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Invoice } from './invoice.entity';
import { lateFee } from './payment-alloc';

/**
 * Applies late fees to overdue invoices and marks them overdue. Runs per-vendor
 * inside a tenant context. One-time fee guarded by invoice.lateFeeApplied.
 * Ledger: Dr Accounts Receivable / Cr Late Fee Income.
 */
@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);
  private readonly pct = Number(process.env.LATE_FEE_PCT ?? 0.1);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
  ) {}

  async applyForInvoices(invoiceIds: string[]): Promise<number> {
    const repo = this.tenant.getRepository(Invoice);
    let applied = 0;
    for (const id of invoiceIds) {
      const invoice = await repo.findOne({ where: { id } });
      if (!invoice || invoice.lateFeeApplied) continue;

      const fee = lateFee(Number(invoice.total), this.pct);
      if (fee > 0) {
        const [ar, lateIncome] = await Promise.all([
          this.accounting.resolveAccount('ACCOUNTS_RECEIVABLE'),
          this.accounting.resolveAccount('LATE_FEE_INCOME'),
        ]);
        await this.ledger.post({
          lines: [
            { accountId: ar.id, debit: fee, entityRef: `invoice:${invoice.id}` },
            { accountId: lateIncome.id, credit: fee },
          ],
        });
      }
      invoice.status = 'overdue';
      invoice.lateFeeApplied = true;
      await repo.save(invoice);

      if (invoice.tenantId) {
        await this.notifications.enqueue({
          vendorId: this.tenant.vendorId ?? '',
          userId: invoice.tenantId,
          template: 'RENT_OVERDUE',
          payload: { period: invoice.period, lateFee: fee, currency: 'ZAR' },
        });
      }
      applied += 1;
    }
    return applied;
  }
}
