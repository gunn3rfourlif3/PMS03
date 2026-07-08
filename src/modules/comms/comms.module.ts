import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
