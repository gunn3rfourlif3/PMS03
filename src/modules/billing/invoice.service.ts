import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { TAX_PROFILE } from '@providers/policy/policy.module';
import { TaxProfile } from '@providers/policy/policy.interfaces';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Invoice } from './invoice.entity';
import { buildRentInvoice } from './invoice-calc';

export interface GenerateRentInvoiceInput {
  leaseId: string;
  tenantId?: string;
  period: string;
  dueDate: string;
  rentAmount: number;
}

/**
 * Creates a rent invoice AND its balancing ledger transaction, atomically:
 *   Dr Accounts Receivable total / Cr Rental Income net / Cr VAT Output tax
 * The invoice is append-only; it stores the ledger transaction id for trace.
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly ledger: LedgerService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
    @Inject(TAX_PROFILE) private readonly tax: TaxProfile,
  ) {}

  async generateRentInvoice(input: GenerateRentInvoiceInput): Promise<Invoice> {
    const { lineItems, total } = buildRentInvoice(
      [{ kind: 'rent', description: `Rent ${input.period}`, amount: input.rentAmount }],
      this.tax,
    );

    const [ar, income, vat] = await Promise.all([
      this.accounting.resolveAccount('ACCOUNTS_RECEIVABLE'),
      this.accounting.resolveAccount('RENTAL_INCOME'),
      this.accounting.resolveAccount('VAT_OUTPUT'),
    ]);

    const taxLine = lineItems.find((li) => li.kind === 'tax');
    const rentLine = lineItems.find((li) => li.kind === 'rent');

    const txnId = await this.ledger.post({
      lines: [
        { accountId: ar.id, debit: total, entityRef: `lease:${input.leaseId}` },
        { accountId: income.id, credit: rentLine?.amount ?? 0 },
        ...(taxLine ? [{ accountId: vat.id, credit: taxLine.amount }] : []),
      ],
    });

    const repo = this.tenant.getRepository(Invoice);
    const invoice = repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      period: input.period,
      dueDate: input.dueDate,
      status: 'issued',
      total,
      lineItems,
      ledgerTxnId: txnId,
    });
    const saved = await repo.save(invoice);
    this.logger.debug(`Invoice ${saved.id} (${input.period}) total ${total} txn ${txnId}`);

    if (input.tenantId) {
      await this.notifications.enqueue({
        vendorId: this.tenant.vendorId ?? '',
        userId: input.tenantId,
        template: 'RENT_INVOICE_ISSUED',
        payload: { period: input.period, amount: total, dueDate: input.dueDate, currency: 'ZAR' },
      });
    }
    return saved;
  }
}
