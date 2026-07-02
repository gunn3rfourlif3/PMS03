import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ExpensesService, RecordExpenseInput } from './expenses.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  record(@Body() body: RecordExpenseInput) {
    return this.expenses.record(body);
  }

  @Get('owners/:ownerId')
  listForOwner(@Param('ownerId') ownerId: string) {
    return this.expenses.listForOwner(ownerId);
  }
}
