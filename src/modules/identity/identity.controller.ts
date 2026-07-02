import { Controller, Get } from '@nestjs/common';
import { IdentityService } from './identity.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }
}
