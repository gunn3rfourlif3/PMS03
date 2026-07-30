import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_PARTNER, JOB_ACCRUE_COMMISSIONS } from '@common/queue/queue.constants';

/** Installs the repeatable monthly partner-commission accrual (1st, 06:30 UTC). */
@Injectable()
export class PartnerCommissionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(PartnerCommissionsScheduler.name);
  constructor(@InjectQueue(QUEUE_PARTNER) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    await this.queue.add(
      JOB_ACCRUE_COMMISSIONS,
      {},
      { repeat: { pattern: '30 6 1 * *' }, jobId: 'accrue-commissions-monthly' },
    );
    this.logger.log(`Recurring partner-commission accrual ensured (current period ${period})`);
  }

  /** Manual trigger for a period (admin/ops). */
  async enqueue(period?: string): Promise<void> {
    await this.queue.add(JOB_ACCRUE_COMMISSIONS, { period });
  }
}
