import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import {
  QUEUE_BILLING,
  JOB_GENERATE_RENT_INVOICES,
  JOB_APPLY_DUNNING,
} from '@common/queue/queue.constants';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { InvoiceService } from './invoice.service';
import { DunningService } from './dunning.service';

interface LeaseRow {
  vendor_id: string;
  lease_id: string;
  tenant_id: string | null;
  rent_amount: string;
}
interface OverdueRow {
  vendor_id: string;
  invoice_id: string;
}

/**
 * Single worker for the billing queue; dispatches by job name. Both jobs pull an
 * inherently cross-tenant worklist via SECURITY DEFINER functions, then do their
 * writes per-vendor inside TenantRunner so everything stays RLS-scoped.
 */
@Processor(QUEUE_BILLING)
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantRunner: TenantRunner,
    private readonly invoices: InvoiceService,
    private readonly dunning: DunningService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ processed: number }> {
    switch (job.name) {
      case JOB_GENERATE_RENT_INVOICES:
        return { processed: await this.generateInvoices(job) };
      case JOB_APPLY_DUNNING:
        return { processed: await this.applyDunning() };
      default:
        return { processed: 0 };
    }
  }

  private async generateInvoices(job: Job): Promise<number> {
    const { period, dueDate } = job.data as { period: string; dueDate: string };
    const rows: LeaseRow[] = await this.dataSource.query(
      'SELECT * FROM billing_active_leases($1)',
      [period],
    );
    const byVendor = this.groupBy(rows, (r) => r.vendor_id);

    let generated = 0;
    for (const [vendorId, leases] of byVendor) {
      await this.tenantRunner.runInVendorContext(vendorId, async () => {
        for (const l of leases) {
          await this.invoices.generateRentInvoice({
            leaseId: l.lease_id,
            tenantId: l.tenant_id ?? undefined,
            period,
            dueDate,
            rentAmount: Number(l.rent_amount),
          });
          generated += 1;
        }
      });
    }
    this.logger.log(`Generated ${generated} invoices for ${period}`);
    return generated;
  }

  private async applyDunning(): Promise<number> {
    const rows: OverdueRow[] = await this.dataSource.query(
      'SELECT * FROM overdue_invoices()',
    );
    const byVendor = this.groupBy(rows, (r) => r.vendor_id);

    let applied = 0;
    for (const [vendorId, list] of byVendor) {
      await this.tenantRunner.runInVendorContext(vendorId, async () => {
        applied += await this.dunning.applyForInvoices(list.map((r) => r.invoice_id));
      });
    }
    this.logger.log(`Applied dunning to ${applied} invoices`);
    return applied;
  }

  private groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      const bucket = map.get(k);
      if (bucket) bucket.push(r);
      else map.set(k, [r]);
    }
    return map;
  }
}
