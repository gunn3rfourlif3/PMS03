import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ErrorReporter } from './error-reporter';

/**
 * Global so the exception filter can be constructed with a reporter in main.ts
 * without every feature module importing it.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [ErrorReporter],
  exports: [ErrorReporter],
})
export class ObservabilityModule {}
