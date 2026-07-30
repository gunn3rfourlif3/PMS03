import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_PARTNER } from '@common/queue/queue.constants';
import { Partner, PartnerMember, PartnerDeal, PartnerActivity, PartnerCommission } from './partner.entities';
import { PartnersService } from './partners.service';
import { PartnerDealsService } from './deals.service';
import { PartnerCommissionsService } from './commissions.service';
import { PartnerCommissionsScheduler } from './commissions.scheduler';
import { PartnerCommissionsProcessor } from './commissions.processor';
import { PartnerController } from './partner.controller';
import { AdminPartnersController } from './admin-partners.controller';
import { AdminCommissionsController } from './admin-commissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partner, PartnerMember, PartnerDeal, PartnerActivity, PartnerCommission]),
    BullModule.registerQueue({ name: QUEUE_PARTNER }),
  ],
  providers: [PartnersService, PartnerDealsService, PartnerCommissionsService, PartnerCommissionsScheduler, PartnerCommissionsProcessor],
  controllers: [PartnerController, AdminPartnersController, AdminCommissionsController],
  exports: [PartnersService, PartnerDealsService, PartnerCommissionsService],
})
export class PartnersModule {}
