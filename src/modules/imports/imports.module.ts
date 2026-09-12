import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_IMPORTS } from '@common/queue/queue.constants';
import { ImportBatch } from './import-batch.entity';
import { TenancyModule } from '@common/tenancy/tenancy.module';
import { ImportsService } from './imports.service';
import { AdminImportsController } from './admin-imports.controller';
import { PublicImportsController } from './public-imports.controller';
import { ImportsScheduler } from './imports.scheduler';
import { ImportsProcessor } from './imports.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch]),
    TenancyModule,
    BullModule.registerQueue({ name: QUEUE_IMPORTS }),
  ],
  providers: [ImportsService, ImportsScheduler, ImportsProcessor],
  controllers: [AdminImportsController, PublicImportsController],
  exports: [ImportsService],
})
export class ImportsModule {}
