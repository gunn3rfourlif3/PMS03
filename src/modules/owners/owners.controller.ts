import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OwnersService } from './owners.service';
import { OwnerStatementService } from './owner-statement.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('owners')
export class OwnersController {
  constructor(
    private readonly owners: OwnersService,
    private readonly statements: OwnerStatementService,
  ) {}

  @Get()
  list() {
    return this.owners.list();
  }

  @Post()
  create(@Body() body: { name: string; managementFeePct?: number; payoutSubaccount?: string }) {
    return this.owners.create(body);
  }

  @Post(':ownerId/statements/:period')
  generate(@Param('ownerId') ownerId: string, @Param('period') period: string) {
    return this.statements.generate(ownerId, period);
  }

  @Post('statements/:statementId/payout')
  payout(@Param('statementId') statementId: string) {
    return this.statements.payout(statementId);
  }
}
