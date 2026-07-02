import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

/**
 * BullMQ root, backed by Redis (same instance used for caching).
 * Domain modules register their own queues via BullModule.registerQueue.
 *
 * BullMQ handles the async, decoupled background work the platform needs:
 * recurring invoice generation, dunning, notification fan-out, report exports —
 * so a run that produces thousands of statements never blocks a web request.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: (() => {
        const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
        return {
          host: url.hostname,
          port: Number(url.port || 6379),
          password: url.password || undefined,
        };
      })(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
