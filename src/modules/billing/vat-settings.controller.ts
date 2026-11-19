import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { InvoicingSettings, VatSettings, VatSettingsService } from './vat-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings/vat')
export class VatSettingsController {
  constructor(private readonly vat: VatSettingsService) {}

  @Get()
  @Roles('vendor_owner', 'property_manager')
  get() {
    return this.vat.get();
  }

  /** Owner only: this changes what tenants are charged. */
  @Put()
  @Roles('vendor_owner')
  update(@Body() body: Partial<VatSettings>) {
    return this.vat.update(body);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings/invoicing')
export class InvoicingSettingsController {
  constructor(private readonly settings: VatSettingsService) {}

  @Get()
  @Roles('vendor_owner', 'property_manager')
  get() {
    return this.settings.getInvoicing();
  }

  /** Owner only: turning this on starts charging tenants for utilities. */
  @Put()
  @Roles('vendor_owner')
  update(@Body() body: Partial<InvoicingSettings>) {
    return this.settings.updateInvoicing(body);
  }
}
