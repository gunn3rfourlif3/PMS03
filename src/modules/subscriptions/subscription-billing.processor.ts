import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_SUBSCRIPTION, JOB_GENERATE_SUB_INVOICES } from '@common/queue/queue.constants';
import { SubscriptionBillingService } from './subscription-billing.service';

@Processor(QUEUE_SUBSCRIPTION)
export class SubscriptionBillingProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionBillingProcessor.name);
  constructor(private readonly billing: SubscriptionBillingService) { super(); }

  async process(job: Job): Promise<{ generated: number; blocked: number }> {
    if (job.name === JOB_GENERATE_SUB_INVOICES) {
      const { period, generated, blocked } = await this.billing.generate(job.data?.period);
      // Blocked agencies bill nothing until a human sets a price, so the count
      // rides on the job result as well as the log — a run that quietly bills
      // fewer agencies than last month should be visible in the queue UI.
      if (blocked > 0) {
        this.logger.error(`${blocked} agenc${blocked === 1 ? 'y was' : 'ies were'} not billed for ${period}: below the published entry point with no agreed price.`);
      }
      return { generated, blocked };
    }
    this.logger.warn(`Unknown job ${job.name}`);
    return { generated: 0, blocked: 0 };
  }
}
