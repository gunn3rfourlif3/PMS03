import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { TAX_PROFILE } from '@providers/policy/policy.module';
import { TaxProfile } from '@providers/policy/policy.interfaces';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Invoice } from './invoice.entity';
import { buildRentInvoice } from './invoice-calc';
import { VatSettingsService } from './vat-settings.service';

export interface GenerateRentInvoiceInput {
  leaseId: string;
  tenantId?: string;
  period: string;
  dueDate: string;
  rentAmount: number;
  description?: string; // overrides the default "Rent <period>" line label
  documentUrl?: string; // if set, the invoice email links to this rendered document
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
    private readonly vatSettings: VatSettingsService,
  ) {}

  async generateRentInvoice(input: GenerateRentInvoiceInput): Promise<Invoice> {
    // VAT only for a VAT-registered agency letting commercially; residential
    // rent is exempt (see vatApplies). Decided here so no caller can forget.
    const vatRule = await this.vatSettings.forLease(input.leaseId);
    const { lineItems, total } = buildRentInvoice(
      [{ kind: 'rent', description: input.description ?? `Rent ${input.period}`, amount: input.rentAmount }],
      vatRule.applies ? this.tax : null,
      { vatNumber: vatRule.vatNumber },
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
      // Empty unless VAT was charged; then the tenant sees the split and the
      // agency's VAT number, as a tax invoice must state.
      const vatBreakdown = taxLine
        ? ` (subtotal ZAR ${(rentLine?.amount ?? 0).toFixed(2)} + VAT ZAR ${taxLine.amount.toFixed(2)}` +
          (taxLine.vatNumber ? `, VAT no. ${taxLine.vatNumber})` : ')')
        : '';
      await this.notifications.enqueue({
        vendorId: this.tenant.vendorId ?? '',
        userId: input.tenantId,
        template: 'RENT_INVOICE_ISSUED',
        payload: {
          period: input.period, amount: total.toFixed(2), vatBreakdown, dueDate: input.dueDate, currency: 'ZAR',
          invoiceLink: input.documentUrl ? `\n\nView your invoice here: ${input.documentUrl}` : '',
          invoiceUrl: input.documentUrl ?? '',
        },
      });
    }
    return saved;
  }
}
