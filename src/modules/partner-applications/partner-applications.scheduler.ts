import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_PARTNER_APPS, JOB_PURGE_REJECTED_APPS, JOB_REMIND_UNFINISHED_APPS } from '@common/queue/queue.constants';

/**
 * Recurring partner-application jobs:
 *  - 03:30 UTC daily — POPIA retention purge of rejected applications.
 *  - hourly — nudge applicants who never finished KYC (the job itself only
 *    picks up those past the reminder window, and only ever once each).
 */
@Injectable()
export class PartnerApplicationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PartnerApplicationsScheduler.name);
  constructor(@InjectQueue(QUEUE_PARTNER_APPS) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(JOB_PURGE_REJECTED_APPS, {}, { repeat: { pattern: '30 3 * * *' }, jobId: 'purge-rejected-apps-daily' });
    await this.queue.add(JOB_REMIND_UNFINISHED_APPS, {}, { repeat: { pattern: '15 * * * *' }, jobId: 'remind-unfinished-apps-hourly' });
    this.logger.log('Recurring partner-application retention purge + reminder jobs ensured');
  }
}
