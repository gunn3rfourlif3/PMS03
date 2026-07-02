import { Controller, Get } from '@nestjs/common';
import { CommsService } from './comms.service';

@Controller('comms')
export class CommsController {
  constructor(private readonly service: CommsService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }
}
