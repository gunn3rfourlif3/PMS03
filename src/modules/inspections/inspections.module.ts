import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { Inspection } from './inspection.entity';
import { BillingModule } from '@modules/billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection]), BillingModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
