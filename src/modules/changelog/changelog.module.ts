import { Module } from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { AdminChangelogController } from './admin-changelog.controller';
import { NotificationProvidersModule } from '@providers/notification/notification-providers.module';

@Module({
  imports: [NotificationProvidersModule],
  providers: [ChangelogService],
  controllers: [AdminChangelogController],
  exports: [ChangelogService],
})
export class ChangelogModule {}
