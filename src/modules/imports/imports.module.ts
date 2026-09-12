import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './import-batch.entity';
import { TenancyModule } from '@common/tenancy/tenancy.module';
import { ImportsService } from './imports.service';
import { AdminImportsController } from './admin-imports.controller';
import { PublicImportsController } from './public-imports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImportBatch]), TenancyModule],
  providers: [ImportsService],
  controllers: [AdminImportsController, PublicImportsController],
  exports: [ImportsService],
})
export class ImportsModule {}
