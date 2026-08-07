import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_PARTNER_APPS, JOB_PURGE_REJECTED_APPS, JOB_REMIND_UNFINISHED_APPS } from '@common/queue/queue.constants';
import { PartnerApplicationsService } from './partner-applications.service';

@Processor(QUEUE_PARTNER_APPS)
export class PartnerApplicationsProcessor extends WorkerHost {
  private readonly logger = new Logger(PartnerApplicationsProcessor.name);
  constructor(private readonly svc: PartnerApplicationsService) { super(); }

  async process(job: Job): Promise<{ purged?: number; sent?: number }> {
    if (job.name === JOB_PURGE_REJECTED_APPS) return this.svc.purgeRejectedDocuments();
    if (job.name === JOB_REMIND_UNFINISHED_APPS) return this.svc.sendReminders();
    this.logger.warn(`Unknown job ${job.name}`);
    return {};
  }
}
