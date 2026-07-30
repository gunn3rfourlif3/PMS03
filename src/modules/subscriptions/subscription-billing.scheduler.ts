import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SUBSCRIPTION, JOB_GENERATE_SUB_INVOICES } from '@common/queue/queue.constants';

/** Monthly subscription-invoice generation (1st, 05:00 UTC — before commission accrual). */
@Injectable()
export class SubscriptionBillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionBillingScheduler.name);
  constructor(@InjectQueue(QUEUE_SUBSCRIPTION) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(JOB_GENERATE_SUB_INVOICES, {}, { repeat: { pattern: '0 5 1 * *' }, jobId: 'gen-sub-invoices-monthly' });
    this.logger.log('Recurring subscription-invoice generation ensured');
  }

  async enqueue(period?: string): Promise<void> {
    await this.queue.add(JOB_GENERATE_SUB_INVOICES, { period });
  }
}
