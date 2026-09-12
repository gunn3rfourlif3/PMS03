import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import { ImportBatch } from './import-batch.entity';
import { ENTITIES, ImportEntity, entitySpec, suggestMapping } from './import-fields';
import { readImportFile, SheetData } from './import-reader';
import { templateCsv, templateXlsx } from './import-template';
import { parseRows } from './import-rows';
import { resolveRows } from './import-resolve';
import { TenantRunner } from '@common/tenancy/tenant-runner.service';
import { TenantContextService } from '@common/tenancy/tenant-context.service';

/** How long an uploaded file may sit before the retention sweep destroys it. */
export const SOURCE_RETENTION_DAYS = Number(process.env.IMPORT_RETENTION_DAYS ?? 7);

/**
 * Agency data import (R-5). Upload, map columns, dry run, commit.
 *
 * This service covers everything up to the dry run. Nothing here writes agency
 * data — reading a file and agreeing what its columns mean has no side effects,
 * which is what makes the mapping step safe to iterate on.
 */
@Injectable()
export class ImportsService {
  private readonly log = new Logger('Imports');
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly tenantRunner: TenantRunner,
    private readonly tenantContext: TenantContextService,
  ) {}

  private repo() { return this.ds.getRepository(ImportBatch); }

  /** The entity list for the UI: what can be imported, and in what order. */
  catalogue(): unknown {
    return ENTITIES.map((s) => ({
      entity: s.entity,
      label: s.label,
      rowIs: s.rowIs,
      naturalKey: s.naturalKey,
      postsToLedger: s.postsToLedger,
      fields: s.fields.map((f) => ({
        key: f.key, label: f.label, type: f.type, required: f.required,
        example: f.example, note: f.note ?? null, choices: f.choices ?? null,
      })),
    }));
  }

  async template(entity: ImportEntity, format: 'xlsx' | 'csv'): Promise<{ body: Buffer; filename: string; mime: string }> {
    const spec = entitySpec(entity);
    if (format === 'csv') {
      return {
        body: Buffer.from(templateCsv(spec), 'utf8'),
        filename: `locare-${entity}-template.csv`,
        mime: 'text/csv; charset=utf-8',
      };
    }
    return {
      body: await templateXlsx(spec),
      filename: `locare-${entity}-template.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Take an uploaded file and propose a mapping. Creates the batch; writes
   * nothing else.
   *
   * A workbook with several sheets returns them all so the operator can pick —
   * guessing which sheet holds the portfolio is exactly the sort of silent
   * decision this feature exists to avoid.
   */
  async upload(
    vendorId: string,
    entity: ImportEntity,
    file: { originalname: string; buffer: Buffer },
    userId: string,
  ): Promise<unknown> {
    const [vendor] = await this.ds.query(`SELECT * FROM platform_agency($1)`, [vendorId]);
    if (!vendor) throw new NotFoundException('Agency not found');

    const spec = entitySpec(entity);
    const sheets = await readImportFile(file.originalname, file.buffer);
    const chosen = pickSheet(sheets, spec.label);

    const batch = await this.repo().save(this.repo().create({
      vendorId,
      entity,
      status: 'mapping',
      filename: file.originalname,
      sheetName: chosen.name,
      source: file.buffer,
      sourceDigest: digest(file.buffer),
      headers: chosen.headers,
      mapping: indexMap(suggestMapping(chosen.headers, spec)),
      rowCount: chosen.rows.length,
    }));

    this.log.log(`Import ${batch.id}: ${entity} for vendor ${vendorId}, ${chosen.rows.length} rows from "${chosen.name}"`);
    return this.describe(batch, sheets, chosen);
  }

  /** Switch to a different sheet in the same uploaded workbook. */
  async chooseSheet(vendorId: string, batchId: string, sheetName: string): Promise<unknown> {
    const batch = await this.load(vendorId, batchId, true);
    this.assertOpen(batch);
    const sheets = await readImportFile(batch.filename, batch.source!);
    const chosen = sheets.find((s) => s.name === sheetName);
    if (!chosen) throw new BadRequestException(`That workbook has no sheet called "${sheetName}".`);

    const spec = entitySpec(batch.entity);
    batch.sheetName = chosen.name;
    batch.headers = chosen.headers;
    batch.mapping = indexMap(suggestMapping(chosen.headers, spec));
    batch.rowCount = chosen.rows.length;
    batch.report = null;
    batch.status = 'mapping';
    await this.repo().save(batch);
    return this.describe(batch, sheets, chosen);
  }

  /**
   * Set the column mapping.
   *
   * Rejects a field mapped to two columns — which value would win is not a
   * question anyone should have to guess the answer to.
   */
  async setMapping(vendorId: string, batchId: string, mapping: Record<string, string>): Promise<unknown> {
    const batch = await this.load(vendorId, batchId, true);
    this.assertOpen(batch);
    const spec = entitySpec(batch.entity);
    const valid = new Set(spec.fields.map((f) => f.key));

    const clean: Record<string, string> = {};
    const used = new Set<string>();
    for (const [col, field] of Object.entries(mapping ?? {})) {
      if (!field) continue;
      const i = Number(col);
      if (!Number.isInteger(i) || i < 0 || i >= batch.headers.length) {
        throw new BadRequestException(`There is no column ${col} in this file.`);
      }
      if (!valid.has(field)) throw new BadRequestException(`"${field}" is not a field on ${spec.label}.`);
      if (used.has(field)) {
        throw new BadRequestException(`Two columns are both mapped to "${field}". Pick one.`);
      }
      used.add(field);
      clean[String(i)] = field;
    }

    batch.mapping = clean;
    batch.report = null;     // any previous dry run described a different mapping
    batch.status = 'mapping';
    await this.repo().save(batch);

    const sheets = await readImportFile(batch.filename, batch.source!);
    const chosen = sheets.find((s) => s.name === batch.sheetName) ?? sheets[0];
    return this.describe(batch, sheets, chosen);
  }

  /**
   * What this file WOULD do. Writes nothing.
   *
   * The point of the whole feature: silent errors become a list with row
   * numbers against them. Runs in the agency's tenant context so every lookup
   * is RLS-scoped — an importer that could see another agency's units would be
   * a worse bug than any it fixes.
   */
  async dryRun(vendorId: string, batchId: string): Promise<unknown> {
    const batch = await this.load(vendorId, batchId, true);
    this.assertOpen(batch);
    const spec = entitySpec(batch.entity);

    const missing = spec.fields.filter((f) => f.required && !Object.values(batch.mapping).includes(f.key));
    if (missing.length) {
      throw new BadRequestException(
        `Map a column to ${missing.map((f) => `"${f.label}"`).join(', ')} before running a check.`,
      );
    }

    const sheets = await readImportFile(batch.filename, batch.source!);
    const sheet = sheets.find((s) => s.name === batch.sheetName) ?? sheets[0];
    const parsed = parseRows(spec, batch.mapping, sheet.rows);

    // `tenantContext.getManager()`, NOT `ds.manager`: runInVendorContext sets
    // app.current_vendor_id with set_config(..., true), which is local to ITS
    // transaction. A query on the default manager runs outside that transaction,
    // so RLS sees no vendor and every lookup comes back empty — every row would
    // then report "no such property" against an agency that has hundreds.
    const report = await this.tenantRunner.runInVendorContext(vendorId, async () =>
      resolveRows(this.tenantContext.getManager(), spec, parsed.rows));

    const full = {
      ...report,
      label: spec.label,
      skippedBlank: parsed.skippedBlank,
      postsToLedger: spec.postsToLedger,
      ranAt: new Date().toISOString(),
      sourceDigest: batch.sourceDigest,
    };

    batch.report = full as unknown as Record<string, unknown>;
    batch.status = 'dry_run';
    batch.rowCount = parsed.rows.length;
    await this.repo().save(batch);

    this.log.log(
      `Dry run ${batch.id} (${batch.entity}): ${report.creates} create, ${report.updates} update, ${report.blocked} blocked`,
    );
    return full;
  }

  /** The stored dry-run report, for a screen refresh or a second pair of eyes. */
  async report(vendorId: string, batchId: string): Promise<unknown> {
    const batch = await this.load(vendorId, batchId);
    if (!batch.report) throw new BadRequestException('No check has been run on this import yet.');
    return batch.report;
  }

  async list(vendorId: string): Promise<unknown[]> {
    const rows = await this.repo().find({
      where: { vendorId }, order: { createdAt: 'DESC' }, take: 50,
    });
    return rows.map((b) => ({
      id: b.id, entity: b.entity, label: entitySpec(b.entity).label, status: b.status,
      filename: b.filename, sheetName: b.sheetName, rowCount: b.rowCount,
      createdAt: b.createdAt, committedAt: b.committedAt,
      sourceHeld: !!b.sourceDigest && b.status !== 'committed' && b.status !== 'discarded',
    }));
  }

  async discard(vendorId: string, batchId: string): Promise<{ discarded: true }> {
    const batch = await this.load(vendorId, batchId);
    if (batch.status === 'committed') throw new BadRequestException('That import has already been committed.');
    batch.status = 'discarded';
    batch.source = null;      // the file goes the moment it is not needed
    await this.repo().save(batch);
    return { discarded: true };
  }

  /**
   * Destroy uploaded files past the retention window.
   *
   * These contain tenants' contact details and owners' banking. Holding them
   * after the import is done is a POPIA liability with no upside.
   */
  async purgeSources(days = SOURCE_RETENTION_DAYS): Promise<{ purged: number }> {
    const res = await this.ds.query(
      `UPDATE import_batches SET source = NULL, updated_at = now()
        WHERE source IS NOT NULL AND created_at < now() - ($1 || ' days')::interval`,
      [Math.max(1, days)],
    );
    const purged = Array.isArray(res) && typeof res[1] === 'number' ? res[1] : 0;
    if (purged) this.log.log(`Purged ${purged} uploaded import file(s) older than ${days}d`);
    return { purged };
  }

  // ── internals ──

  private async load(vendorId: string, id: string, withSource = false): Promise<ImportBatch> {
    const qb = this.repo().createQueryBuilder('b').where('b.id = :id AND b.vendor_id = :vendorId', { id, vendorId });
    if (withSource) qb.addSelect('b.source');
    const batch = await qb.getOne();
    if (!batch) throw new NotFoundException('Import not found');
    if (withSource && !batch.source) {
      throw new BadRequestException('The uploaded file for this import is no longer held. Upload it again.');
    }
    return batch;
  }

  private assertOpen(b: ImportBatch): void {
    if (b.status === 'committed') throw new BadRequestException('That import has already been committed.');
    if (b.status === 'discarded') throw new BadRequestException('That import was discarded.');
  }

  private describe(batch: ImportBatch, sheets: SheetData[], chosen: SheetData): unknown {
    const spec = entitySpec(batch.entity);
    const mapped = new Set(Object.values(batch.mapping));
    return {
      id: batch.id,
      entity: batch.entity,
      label: spec.label,
      status: batch.status,
      filename: batch.filename,
      rowCount: chosen.rows.length,
      sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.length })),
      sheetName: chosen.name,
      headers: chosen.headers,
      mapping: batch.mapping,
      /** First few rows, so the operator can see what they are mapping. */
      sample: chosen.rows.slice(0, 5).map((r) => r.map(cellForDisplay)),
      fields: spec.fields.map((f) => ({
        key: f.key, label: f.label, type: f.type, required: f.required,
        note: f.note ?? null, choices: f.choices ?? null, mapped: mapped.has(f.key),
      })),
      missingRequired: spec.fields.filter((f) => f.required && !mapped.has(f.key)).map((f) => f.label),
      postsToLedger: spec.postsToLedger,
    };
  }
}

const digest = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** jsonb keys are strings; normalise the suggestion map to match. */
const indexMap = (m: Record<number, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), v]));

const cellForDisplay = (v: unknown): string =>
  v === null || v === undefined ? ''
    : v instanceof Date ? v.toISOString().slice(0, 10)
      : String(v);

/**
 * Which sheet to start on.
 *
 * Prefer one named like the entity ("Units", "Leases"), else the one with the
 * most rows — a portfolio sheet is almost always bigger than a notes tab. The
 * operator can change it, and the UI shows every sheet with its row count.
 */
function pickSheet(sheets: SheetData[], label: string): SheetData {
  const want = label.toLowerCase().replace(/[^a-z]/g, '');
  const named = sheets.find((s) => s.name.toLowerCase().replace(/[^a-z]/g, '') === want);
  if (named) return named;
  return [...sheets].sort((a, b) => b.rows.length - a.rows.length)[0];
}
