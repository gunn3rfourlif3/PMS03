import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnersModule } from '@modules/partners/partners.module';
import { PartnerApplication } from './partner-application.entity';
import { PartnerApplicationsService } from './partner-applications.service';
import { PartnerApplicationsController } from './partner-applications.controller';
import { AdminPartnerApplicationsController } from './admin-partner-applications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerApplication]), PartnersModule],
  controllers: [PartnerApplicationsController, AdminPartnerApplicationsController],
  providers: [PartnerApplicationsService],
})
export class PartnerApplicationsModule {}
