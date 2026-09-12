import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_IMPORTS, JOB_PURGE_IMPORT_SOURCES } from '@common/queue/queue.constants';

/**
 * Destroys uploaded import files past the retention window (03:45 UTC daily).
 *
 * These files hold other people's personal information — tenants' contact
 * details, owners' banking — and they exist only to be read during an import
 * that takes minutes. Keeping them afterwards is a POPIA liability with no
 * upside, and "someone will remember to delete it" is not a retention policy.
 *
 * Runs a quarter of an hour after the partner-application purge so the two
 * POPIA sweeps are adjacent in the logs rather than interleaved.
 */
@Injectable()
export class ImportsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ImportsScheduler.name);
  constructor(@InjectQueue(QUEUE_IMPORTS) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      JOB_PURGE_IMPORT_SOURCES, {},
      { repeat: { pattern: '45 3 * * *' }, jobId: 'purge-import-sources-daily' },
    );
    this.logger.log('Recurring import-file retention purge ensured');
  }
}
