import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './agent.entity';
import { AgentCommission } from './agent-commission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent, AgentCommission])],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
