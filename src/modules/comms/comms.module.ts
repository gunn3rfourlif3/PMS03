import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CommsEvents } from './comms.events';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'change-me-in-prod' }),
  ],
  controllers: [CommsController],
  providers: [CommsService, CommsEvents],
  exports: [CommsService],
})
export class CommsModule {}
