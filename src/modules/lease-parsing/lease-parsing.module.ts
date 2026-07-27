import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseParsingController } from './lease-parsing.controller';
import { LeaseParsingService } from './lease-parsing.service';
import { LeaseExtractionRecord } from './lease-extraction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LeaseExtractionRecord])],
  controllers: [LeaseParsingController],
  providers: [LeaseParsingService],
})
export class LeaseParsingModule {}
