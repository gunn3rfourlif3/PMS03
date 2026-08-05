import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PartnersModule } from '@modules/partners/partners.module';
import { QUEUE_PARTNER_APPS } from '@common/queue/queue.constants';
import { PartnerApplication } from './partner-application.entity';
import { PartnerApplicationsService } from './partner-applications.service';
import { PartnerApplicationsController } from './partner-applications.controller';
import { AdminPartnerApplicationsController } from './admin-partner-applications.controller';
import { PartnerApplicationsScheduler } from './partner-applications.scheduler';
import { PartnerApplicationsProcessor } from './partner-applications.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartnerApplication]),
    BullModule.registerQueue({ name: QUEUE_PARTNER_APPS }),
    PartnersModule,
  ],
  controllers: [PartnerApplicationsController, AdminPartnerApplicationsController],
  providers: [PartnerApplicationsService, PartnerApplicationsScheduler, PartnerApplicationsProcessor],
})
export class PartnerApplicationsModule {}
