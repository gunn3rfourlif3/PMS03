import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { MAX_IMPORT_BYTES } from './import-reader';
import { ENTITIES, ImportEntity } from './import-fields';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

const ENTITY_KEYS = new Set(ENTITIES.map((e) => e.entity));
const asEntity = (v: string): ImportEntity => {
  if (!ENTITY_KEYS.has(v as ImportEntity)) throw new BadRequestException(`"${v}" is not something Locare imports.`);
  return v as ImportEntity;
};

/**
 * Platform-admin only. Importing an agency's portfolio is operator work during
 * onboarding; the agency-facing route, if it ever exists, is the tokenised view
 * in the onboarding console's phase 4.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/imports')
export class AdminImportsController {
  constructor(private readonly svc: ImportsService) {}

  /** What can be imported, with the fields — drives the whole UI. */
  @Get('catalogue') catalogue() { return this.svc.catalogue(); }

  // The blank templates moved to PublicImportsController: they contain no
  // agency data, and an agency should be able to open a link to one without a
  // Locare login.

  @Get(':vendorId') list(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.svc.list(vendorId);
  }

  @Post(':vendorId/:entity')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  upload(
    @CurrentTenant() principal: { userId: string },
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('entity') entity: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer },
  ) {
    if (!file?.buffer) throw new BadRequestException('No file was uploaded.');
    return this.svc.upload(vendorId, asEntity(entity), file, principal.userId);
  }

  @Post(':vendorId/batch/:batchId/sheet')
  sheet(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: { sheetName: string },
  ) {
    if (!body?.sheetName) throw new BadRequestException('Which sheet?');
    return this.svc.chooseSheet(vendorId, batchId, body.sheetName);
  }

  @Post(':vendorId/batch/:batchId/mapping')
  mapping(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: { mapping: Record<string, string> },
  ) {
    return this.svc.setMapping(vendorId, batchId, body?.mapping ?? {});
  }

  /** Check the file. Writes nothing — safe to run as often as needed. */
  @Post(':vendorId/batch/:batchId/check')
  check(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.svc.dryRun(vendorId, batchId);
  }

  @Get(':vendorId/batch/:batchId/report')
  report(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.svc.report(vendorId, batchId);
  }

  @Post(':vendorId/batch/:batchId/discard')
  discard(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ) {
    return this.svc.discard(vendorId, batchId);
  }
}
