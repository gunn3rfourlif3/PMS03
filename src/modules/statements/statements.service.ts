import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { PaymentService } from '@modules/billing/payment.service';
import { readImportFile, MAX_IMPORT_BYTES } from '@modules/imports/import-reader';
import { parseStatementRows } from './statement-parse';
import {
  matchStatement, matchSummary, OpenInvoice, StatementLine, StatementMatchResult,
} from '@providers/payment/statement-import';

export interface PreviewResult {
  mapping: Record<string, string>;
  skipped: { row: number; reason: string }[];
  summary: ReturnType<typeof matchSummary>;
  matched: {
    lineId: string; date: string; description?: string; reference?: string;
    amount: number; invoiceId: string; basis: string; period: string; unit?: string;
  }[];
  unmatched: { lineId: string; date: string; description?: string; amount: number; reason: string; candidates?: string[] }[];
}

/**
 * Bank-statement reconciliation — the mode A rent path
 * (docs/LOCARE_ONSITE_DEMO_BUILD_PLAN.md Day 5).
 *
 * TWO STEPS ON PURPOSE. `preview` reads the file and matches, and writes
 * NOTHING. `commit` takes the matches a human has looked at and records them.
 *
 * Nothing is allocated without someone seeing it first. The matcher refuses to
 * guess at an ambiguous line, but even a confident match is money moving
 * against a named tenant's invoice, and the cost of getting that wrong is a
 * tenant wrongly chased weeks later.
 */
@Injectable()
export class StatementsService {
  private readonly log = new Logger('Statements');

  constructor(
    private readonly tenant: TenantContextService,
    private readonly payments: PaymentService,
  ) {}

  /** Invoices with anything still owing, and what is owing on each. */
  private async openInvoices(): Promise<(OpenInvoice & { period: string; unit?: string })[]> {
    return this.tenant.getManager().query(`
      SELECT i.id,
             i.tenant_id              AS "tenantId",
             i.period                 AS period,
             i.due_date::text         AS "dueDate",
             u.label                  AS unit,
             (i.total - COALESCE((
                SELECT SUM((a->>'amount')::numeric)
                  FROM payments p, jsonb_array_elements(p.allocation) a
                 WHERE p.vendor_id = i.vendor_id
                   AND p.status = 'succeeded'
                   AND (a->>'invoiceId')::uuid = i.id
             ), 0))::float8           AS outstanding
        FROM invoices i
        LEFT JOIN leases l ON l.id = i.lease_id
        LEFT JOIN units  u ON u.id = l.unit_id
       WHERE i.vendor_id = $1
         AND i.status IN ('issued', 'partly_paid', 'overdue')
    `, [this.tenant.vendorId]);
  }

  async preview(filename: string, buf: Buffer): Promise<PreviewResult> {
    if (!buf?.length) throw new BadRequestException('The file is empty');
    if (buf.length > MAX_IMPORT_BYTES) throw new BadRequestException('That file is too large');

    const sheets = await readImportFile(filename, buf);
    const rows = sheets?.[0]?.rows ?? [];
    const parsed = parseStatementRows(rows as string[][]);

    const invoices = await this.openInvoices();
    const result = matchStatement(parsed.lines, invoices);
    const byId = new Map(invoices.map((i) => [i.id, i]));

    return {
      mapping: parsed.mapping,
      skipped: parsed.skipped,
      summary: matchSummary(result),
      matched: result.matched.map((m) => ({
        lineId: m.line.id,
        date: m.line.date,
        description: m.line.description,
        reference: m.line.reference,
        amount: m.amount,
        invoiceId: m.invoice.id,
        basis: m.basis,
        period: byId.get(m.invoice.id)?.period ?? '',
        unit: byId.get(m.invoice.id)?.unit,
      })),
      unmatched: result.unmatched.map((u) => ({
        lineId: u.line.id,
        date: u.line.date,
        description: u.line.description,
        amount: u.line.amount,
        reason: u.reason,
        candidates: u.candidates,
      })),
    };
  }

  /**
   * Record the allocations a human confirmed.
   *
   * Through `PaymentService.recordManual`, so each one posts to the ledger
   * exactly as a manually captured payment does. No second payment path, and no
   * postings written here — the ledger has one way in.
   *
   * One failure does not abandon the rest: a statement is forty lines and
   * stopping at line nine would leave the operator with no idea which eight
   * landed. Each result is reported individually.
   */
  async commit(
    allocations: { invoiceId: string; amount: number; reference?: string }[],
  ): Promise<{ recorded: number; failed: { invoiceId: string; reason: string }[] }> {
    if (!Array.isArray(allocations) || allocations.length === 0) {
      throw new BadRequestException('Nothing to record');
    }
    const failed: { invoiceId: string; reason: string }[] = [];
    let recorded = 0;

    for (const a of allocations) {
      try {
        if (!(Number(a.amount) > 0)) throw new Error('Amount must be greater than zero');
        await this.payments.recordManual(a.invoiceId, Number(a.amount), {
          method: 'eft',
          reference: a.reference || `statement:${new Date().toISOString().slice(0, 10)}`,
        });
        recorded++;
      } catch (e: any) {
        failed.push({ invoiceId: a.invoiceId, reason: e?.message ?? 'Could not record' });
      }
    }

    this.log.log(`Statement commit: ${recorded} recorded, ${failed.length} failed`);
    return { recorded, failed };
  }
}
