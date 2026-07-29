import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner, PartnerMember, PartnerDeal, PartnerActivity } from './partner.entities';
import { PartnersService } from './partners.service';
import { PartnerDealsService } from './deals.service';
import { PartnerController } from './partner.controller';
import { AdminPartnersController } from './admin-partners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Partner, PartnerMember, PartnerDeal, PartnerActivity])],
  providers: [PartnersService, PartnerDealsService],
  controllers: [PartnerController, AdminPartnersController],
  exports: [PartnersService, PartnerDealsService],
})
export class PartnersModule {}
