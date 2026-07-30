import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_SUBSCRIPTION, JOB_GENERATE_SUB_INVOICES } from '@common/queue/queue.constants';
import { SubscriptionBillingService } from './subscription-billing.service';

@Processor(QUEUE_SUBSCRIPTION)
export class SubscriptionBillingProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionBillingProcessor.name);
  constructor(private readonly billing: SubscriptionBillingService) { super(); }

  async process(job: Job): Promise<{ generated: number }> {
    if (job.name === JOB_GENERATE_SUB_INVOICES) {
      const { generated } = await this.billing.generate(job.data?.period);
      return { generated };
    }
    this.logger.warn(`Unknown job ${job.name}`);
    return { generated: 0 };
  }
}
