import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('rent-roll')
  rentRoll() {
    return this.service.rentRoll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('arrears')
  arrears() {
    return this.service.arrearsAging();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('collection/:period')
  collection(@Param('period') period: string) {
    return this.service.collectionSummary(period);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('income/:period')
  income(@Param('period') period: string) {
    return this.service.incomeStatement(period);
  }
}
