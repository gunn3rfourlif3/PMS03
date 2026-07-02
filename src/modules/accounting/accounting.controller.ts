import { Controller, Get } from '@nestjs/common';
import { AccountingService } from './accounting.service';

@Controller('accounting')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }
}
