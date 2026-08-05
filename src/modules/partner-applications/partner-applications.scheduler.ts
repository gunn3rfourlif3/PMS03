import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_PARTNER_APPS, JOB_PURGE_REJECTED_APPS } from '@common/queue/queue.constants';

/** Daily POPIA retention purge of rejected partner applications (03:30 UTC). */
@Injectable()
export class PartnerApplicationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PartnerApplicationsScheduler.name);
  constructor(@InjectQueue(QUEUE_PARTNER_APPS) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(JOB_PURGE_REJECTED_APPS, {}, { repeat: { pattern: '30 3 * * *' }, jobId: 'purge-rejected-apps-daily' });
    this.logger.log('Recurring partner-application retention purge ensured');
  }
}
