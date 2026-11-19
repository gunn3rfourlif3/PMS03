import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_BILLING,
  JOB_GENERATE_RENT_INVOICES,
  JOB_APPLY_DUNNING,
} from '@common/queue/queue.constants';

/**
 * Installs the repeatable rent-invoice job (monthly) and dunning job (daily).
 * BullMQ dedupes by repeat key so multiple instances won't duplicate schedules.
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(@InjectQueue(QUEUE_BILLING) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // The monthly run carries NO period: the processor reads the month when the
    // job fires. It used to be registered with the boot month baked into its
    // data — and a repeating job reuses its data, so every 1st it re-ran the
    // month the API last started in, found it billed, and billed nothing new.
    // Those old month-stamped schedules are still in Redis; clear them.
    for (const r of await this.queue.getRepeatableJobs()) {
      if (r.name === JOB_GENERATE_RENT_INVOICES && /^rent-invoices-\d{4}-\d{2}$/.test(r.id ?? '')) {
        await this.queue.removeRepeatableByKey(r.key);
        this.logger.warn(`Removed stale rent-invoice schedule ${r.id}`);
      }
    }
    await this.queue.upsertJobScheduler(
      'rent-invoices-monthly',
      { pattern: '0 6 1 * *' },
      { name: JOB_GENERATE_RENT_INVOICES, data: {} },
    );

    await this.queue.add(
      JOB_APPLY_DUNNING,
      {},
      {
        repeat: { pattern: '0 7 * * *' },
        jobId: 'apply-dunning-daily',
      },
    );
    this.logger.log('Recurring rent-invoice + dunning jobs ensured');
  }

  /**
   * A run for one agency, from its back office. `vendorId` is required: the
   * worker bills every agency when a job carries none, which is right for the
   * monthly schedule and wrong for a button any agency's staff can press.
   */
  async enqueueForVendor(vendorId: string, period: string, dueDate: string): Promise<void> {
    await this.queue.add(JOB_GENERATE_RENT_INVOICES, { period, dueDate, vendorId });
  }
}
