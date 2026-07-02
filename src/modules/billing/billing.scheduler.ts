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
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const dueDate = `${period}-07`;

    await this.queue.add(
      JOB_GENERATE_RENT_INVOICES,
      { period, dueDate },
      {
        repeat: { pattern: '0 6 1 * *' },
        jobId: `rent-invoices-${period}`,
      },
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

  /** Manual trigger for a specific period (dev/ops). */
  async enqueueForPeriod(period: string, dueDate: string): Promise<void> {
    await this.queue.add(JOB_GENERATE_RENT_INVOICES, { period, dueDate });
  }
}
