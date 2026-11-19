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
  async rentRoll() {
    // The back-office query now also returns the tenant's and property's names
    // for the dashboard. This endpoint is read by agencies' API-key
    // integrations, and widening a third-party feed to carry tenants' names is
    // a POPIA decision, not a side effect — so its shape stays as it was.
    const rows = (await this.reporting.rentRoll()) as Array<Record<string, unknown>>;
    return rows.map(({ tenant_name, property_name, ...rest }) => rest);
  }
}
