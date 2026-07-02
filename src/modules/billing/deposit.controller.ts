import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('deposits')
export class DepositController {
  constructor(private readonly deposits: DepositService) {}

  @Post('leases/:leaseId')
  capture(@Param('leaseId') leaseId: string, @Body() body: { amount: number; heldIn?: string }) {
    return this.deposits.capture(leaseId, body.amount, body.heldIn);
  }

  @Post(':depositId/interest')
  accrue(@Param('depositId') depositId: string, @Body() body: { interest: number }) {
    return this.deposits.accrueInterest(depositId, body.interest);
  }

  @Post(':depositId/return')
  returnDeposit(@Param('depositId') depositId: string, @Body() body: { deductions?: number[] }) {
    return this.deposits.returnDeposit(depositId, body.deductions ?? []);
  }
}
