import { Controller, Get } from '@nestjs/common';
import { LeasingService } from './leasing.service';

@Controller('leasing')
export class LeasingController {
  constructor(private readonly service: LeasingService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }
}
