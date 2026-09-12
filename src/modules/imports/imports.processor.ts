import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_IMPORTS, JOB_PURGE_IMPORT_SOURCES } from '@common/queue/queue.constants';
import { ImportsService } from './imports.service';

@Processor(QUEUE_IMPORTS)
export class ImportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportsProcessor.name);
  constructor(private readonly imports: ImportsService) { super(); }

  async process(job: Job): Promise<{ purged: number }> {
    if (job.name === JOB_PURGE_IMPORT_SOURCES) return this.imports.purgeSources();
    this.logger.warn(`Unknown job ${job.name}`);
    return { purged: 0 };
  }
}
