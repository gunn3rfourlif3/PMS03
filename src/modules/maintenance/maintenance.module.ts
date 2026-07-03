import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { Ticket } from './ticket.entity';
import { WorkOrder } from './work-order.entity';
import { ExpensesModule } from '@modules/expenses/expenses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, WorkOrder]), ExpensesModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
