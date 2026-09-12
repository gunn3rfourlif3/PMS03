import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './import-batch.entity';
import { ImportsService } from './imports.service';
import { AdminImportsController } from './admin-imports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImportBatch])],
  providers: [ImportsService],
  controllers: [AdminImportsController],
  exports: [ImportsService],
})
export class ImportsModule {}
