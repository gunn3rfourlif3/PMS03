import { Global, Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

/** Global so any module (listings, inspections) can inject MediaService. */
@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
