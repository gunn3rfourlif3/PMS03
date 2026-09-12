import { Module } from '@nestjs/common';
import { HostsController } from './hosts.controller';
import { AdminDomainsController } from './admin-domains.controller';
import { HostsService } from './hosts.service';

@Module({
  controllers: [HostsController, AdminDomainsController],
  providers: [HostsService],
  exports: [HostsService],
})
export class HostsModule {}
