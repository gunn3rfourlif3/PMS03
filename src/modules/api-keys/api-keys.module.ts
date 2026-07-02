import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysController } from './api-keys.controller';
import { ExternalApiController } from './external-api.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKey } from './api-key.entity';
import { ReportingModule } from '@modules/reporting/reporting.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), ReportingModule],
  controllers: [ApiKeysController, ExternalApiController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
