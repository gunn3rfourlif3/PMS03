import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_PARTNER, JOB_ACCRUE_COMMISSIONS } from '@common/queue/queue.constants';
import { PartnerCommissionsService } from './commissions.service';

@Processor(QUEUE_PARTNER)
export class PartnerCommissionsProcessor extends WorkerHost {
  private readonly logger = new Logger(PartnerCommissionsProcessor.name);
  constructor(private readonly commissions: PartnerCommissionsService) { super(); }

  async process(job: Job): Promise<{ accrued: number }> {
    if (job.name === JOB_ACCRUE_COMMISSIONS) {
      const { accrued } = await this.commissions.accrue(job.data?.period);
      return { accrued };
    }
    this.logger.warn(`Unknown job ${job.name}`);
    return { accrued: 0 };
  }
}
