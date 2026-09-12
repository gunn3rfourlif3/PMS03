import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ImportsService } from './imports.service';
import { ENTITIES, ImportEntity } from './import-fields';

const ENTITY_KEYS = new Set(ENTITIES.map((e) => e.entity));

/**
 * PUBLIC: the blank import templates.
 *
 * Unauthenticated on purpose. A template is a header row, an example row and a
 * page of instructions — it contains no agency data and nothing worth
 * protecting, and it is the one file you most want to be able to send an agency
 * a link to. Keeping it behind a login meant the only way to get one was a
 * browser console, which is not a thing to ask a principal to do.
 *
 * Generated per request from the field definitions rather than served from
 * disk, so a template can never describe columns the importer does not read.
 */
@Controller('imports')
export class PublicImportsController {
  constructor(private readonly svc: ImportsService) {}

  /** What Locare can import — enough to build a link list, no agency data. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('templates')
  templates() {
    return ENTITIES.map((s) => ({
      entity: s.entity,
      label: s.label,
      rowIs: s.rowIs,
      postsToLedger: s.postsToLedger,
      columns: s.fields.map((f) => ({ label: f.label, required: f.required, note: f.note ?? null })),
      xlsx: `/api/imports/template/${s.entity}`,
      csv: `/api/imports/template/${s.entity}?format=csv`,
    }));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('template/:entity')
  async template(
    @Param('entity') entity: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!ENTITY_KEYS.has(entity as ImportEntity)) {
      throw new BadRequestException(`"${entity}" is not something Locare imports.`);
    }
    const { body, filename, mime } = await this.svc.template(
      entity as ImportEntity, format === 'csv' ? 'csv' : 'xlsx',
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Templates only change when the field definitions do, which is a deploy.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  }
}
