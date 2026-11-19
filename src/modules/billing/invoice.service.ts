import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { LedgerService } from '@modules/accounting/ledger.service';
import { AccountingService } from '@modules/accounting/accounting.service';
import { TAX_PROFILE } from '@providers/policy/policy.module';
import { TaxProfile } from '@providers/policy/policy.interfaces';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Invoice } from './invoice.entity';
import { buildRentInvoice } from './invoice-calc';
import { buildRecoveryLines, RecoverableReading } from '@modules/utilities/utility-recovery';
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

    // Utilities, when the agency bills them: the unit's submeter readings not
    // yet on any invoice, at actual cost (utility-recovery.ts). Locked FOR
    // UPDATE and marked with this invoice below, in the same transaction, so a
    // reading is billed exactly once even if two runs overlap.
    const utilities = vatRule.billUtilities && vatRule.unitId
      ? buildRecoveryLines(await this.unbilledReadings(vatRule.unitId), input.period)
      : { lines: [], skipped: [], total: 0 };

    const { lineItems, total } = buildRentInvoice(
      [
        { kind: 'rent', description: input.description ?? `Rent ${input.period}`, amount: input.rentAmount },
        ...utilities.lines.map((l) => ({ kind: l.kind, description: l.description, amount: l.amount })),
      ],
      vatRule.applies ? this.tax : null,
      { vatNumber: vatRule.vatNumber },
    );

    const [ar, income, vat, recovery] = await Promise.all([
      this.accounting.resolveAccount('ACCOUNTS_RECEIVABLE'),
      this.accounting.resolveAccount('RENTAL_INCOME'),
      this.accounting.resolveAccount('VAT_OUTPUT'),
      utilities.total > 0 ? this.accounting.resolveAccount('EXPENSE_RECOVERY') : Promise.resolve(null),
    ]);

    const taxLine = lineItems.find((li) => li.kind === 'tax');
    const rentLine = lineItems.find((li) => li.kind === 'rent');
    const utilityTotal = Math.round(
      lineItems.filter((li) => li.kind === 'utility').reduce((s, li) => s + li.amount, 0) * 100,
    ) / 100;

    // Utilities credit Expense Recovery, not Rental Income: they are the
    // municipality's charge passed through at cost, not the agency's earnings.
    const txnId = await this.ledger.post({
      lines: [
        { accountId: ar.id, debit: total, entityRef: `lease:${input.leaseId}` },
        { accountId: income.id, credit: rentLine?.amount ?? 0 },
        ...(recovery && utilityTotal > 0 ? [{ accountId: recovery.id, credit: utilityTotal }] : []),
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

    const billedReadingIds = utilities.lines.flatMap((l) => l.readingIds);
    if (billedReadingIds.length > 0) {
      await this.tenant.getManager().query(
        `UPDATE utility_readings SET invoice_id = $1, updated_at = now()
          WHERE id = ANY($2::uuid[]) AND invoice_id IS NULL`,
        [saved.id, billedReadingIds],
      );
    }
    this.logger.debug(`Invoice ${saved.id} (${input.period}) total ${total} txn ${txnId}`);

    if (input.tenantId) {
      // Empty unless VAT was charged; then the tenant sees the split and the
      // agency's VAT number, as a tax invoice must state.
      const vatBreakdown = taxLine
        ? ` (subtotal ZAR ${(total - taxLine.amount).toFixed(2)} + VAT ZAR ${taxLine.amount.toFixed(2)}` +
          (taxLine.vatNumber ? `, VAT no. ${taxLine.vatNumber})` : ')')
        : '';
      // Where the rent is for, so the email can say so. RLS-scoped read.
      const [where] = await this.tenant.getManager().query(
        `SELECT u.label AS "unitLabel", p.name AS "propertyName"
           FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
          WHERE l.id = $1`,
        [input.leaseId],
      );
      await this.notifications.enqueue({
        vendorId: this.tenant.vendorId ?? '',
        userId: input.tenantId,
        template: 'RENT_INVOICE_ISSUED',
        payload: {
          period: input.period, amount: total.toFixed(2), vatBreakdown, dueDate: input.dueDate, currency: 'ZAR',
          // For the invoice layout (templates.ts → rentInvoiceEmail).
          lines: lineItems,
          reference: invoiceReference(saved.id, input.period),
          issuedOn: new Date().toISOString().slice(0, 10),
          unitLabel: where?.unitLabel ?? '',
          propertyName: where?.propertyName ?? '',
          invoiceLink: input.documentUrl ? `\n\nView your invoice here: ${input.documentUrl}` : '',
          invoiceUrl: input.documentUrl ?? '',
        },
      });
    }
    return saved;
  }

  /**
   * A unit's unbilled submeter readings, locked for this transaction. Only
   * meters on the unit itself: a bulk meter hangs off the property, and its
   * cost is the landlord's (buildRecoveryLines refuses one anyway).
   */
  private async unbilledReadings(unitId: string): Promise<RecoverableReading[]> {
    return this.tenant.getManager().query(
      `SELECT r.id, r.meter_id AS "meterId", m.unit_id AS "unitId", m.kind,
              r.reading_date::text AS "readingDate",
              r.consumption::float8 AS consumption, r.cost::float8 AS cost, r.estimated
         FROM utility_readings r
         JOIN utility_meters m ON m.id = r.meter_id
        WHERE m.unit_id = $1
          AND r.invoice_id IS NULL
          AND r.deleted_at IS NULL
          AND m.deleted_at IS NULL
          AND r.reading_date <= current_date
        ORDER BY r.reading_date
        FOR UPDATE OF r`,
      [unitId],
    );
  }
}

/**
 * A human reference for an invoice: INV-202611-3F9A2C. Derived from the
 * period and the invoice id, so it is stable and unique per invoice — but it
 * is NOT a sequential serial number, which SARS expects on a tax invoice.
 */
export function invoiceReference(id: string, period: string): string {
  return `INV-${period.replace('-', '')}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
