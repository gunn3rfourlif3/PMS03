import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilitiesController } from './utilities.controller';
import { UtilitiesService } from './utilities.service';
import { UtilityMeter } from './utility-meter.entity';
import { UtilityReading } from './utility-reading.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UtilityMeter, UtilityReading])],
  controllers: [UtilitiesController],
  providers: [UtilitiesService],
  exports: [UtilitiesService],
})
export class UtilitiesModule {}
