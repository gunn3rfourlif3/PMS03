import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ReportingService } from '@modules/reporting/reporting.service';

/**
 * Example external (machine-to-machine) API surface, authenticated by API key.
 * Everything here is RLS-scoped to the key's vendor via the guard + interceptor.
 */
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class ExternalApiController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('rent-roll')
  rentRoll() {
    return this.reporting.rentRoll();
  }
}
