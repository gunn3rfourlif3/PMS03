import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { UtilityMeter, UtilityKind, UtilityUom } from './utility-meter.entity';
import { UtilityReading } from './utility-reading.entity';
import { computeConsumption, deriveCost, isConsumptionError } from './utility-calc';
import { computeGaps, GapRow, GapResult } from './utility-gap';

export interface CreateMeterInput {
  /** Exactly one of these. A submeter hangs off a unit, a bulk meter off a property. */
  unitId?: string | null;
  propertyId?: string | null;
  kind: UtilityKind;
  serial?: string;
  label?: string;
  unitOfMeasure?: UtilityUom;
  multiplier?: number;
  dialDigits?: number;
  notes?: string;
}

export interface CaptureReadingInput {
  meterId: string;
  readingDate: string;
  reading?: number | null;
  rollover?: boolean;
  estimated?: boolean;
  tariffRate?: number | null;
  cost?: number | null;
  media?: string[];
  note?: string;
}

/** Which utilities are read off a dial, and the unit each is measured in. */
const METERED: Record<UtilityKind, boolean> = {
  electricity: true, water: true, gas: true, sewerage: false, refuse: false,
};
const DEFAULT_UOM: Record<UtilityKind, UtilityUom> = {
  electricity: 'kWh', water: 'kL', gas: 'm3', sewerage: 'fixed', refuse: 'fixed',
};

/**
 * Municipal utility capture — see docs/LOCARE_UTILITIES_BUILD_PLAN.md.
 *
 * Record only: nothing here posts to the ledger or raises an invoice line. The
 * `utility` invoice line kind exists, but what to recover is a commercial
 * decision that has not been made.
 */
@Injectable()
export class UtilitiesService {
  private readonly logger = new Logger(UtilitiesService.name);

  constructor(private readonly tenant: TenantContextService) {}

  ping(): string {
    return 'Utilities module ready';
  }

  // ---------------- meters ----------------

  async createMeter(input: CreateMeterInput): Promise<UtilityMeter> {
    const hasUnit = !!input.unitId;
    const hasProperty = !!input.propertyId;
    if (hasUnit === hasProperty) {
      // Mirrors ck_utility_meters_attachment. Caught here so the back office
      // gets a sentence rather than a constraint-violation stack.
      throw new BadRequestException(
        'A meter belongs to a unit (a submeter) or a property (the bulk meter), not both and not neither',
      );
    }
    const metered = METERED[input.kind];
    if (input.multiplier !== undefined && !(Number(input.multiplier) > 0)) {
      throw new BadRequestException('Multiplier must be greater than zero');
    }

    const repo = this.tenant.getRepository(UtilityMeter);
    return repo.save(
      repo.create({
        vendorId: this.tenant.vendorId ?? undefined,
        unitId: input.unitId ?? null,
        propertyId: input.propertyId ?? null,
        kind: input.kind,
        metered,
        unitOfMeasure: input.unitOfMeasure ?? DEFAULT_UOM[input.kind],
        serial: input.serial ?? null,
        label: input.label ?? null,
        multiplier: input.multiplier ?? 1,
        dialDigits: input.dialDigits ?? null,
        status: 'active',
        notes: input.notes ?? null,
      }),
    );
  }

  /**
   * Paged on purpose. An agency with a submeter per unit has one row per unit
   * per utility — at 500 units that is thousands, and the on-site demo already
   * showed what an unpaginated list of that size does to a page.
   */
  async listMeters(
    filter?: { unitId?: string; propertyId?: string; limit?: number; offset?: number },
  ): Promise<{ rows: UtilityMeter[]; total: number; limit: number; offset: number }> {
    const repo = this.tenant.getRepository(UtilityMeter);
    const where: Record<string, unknown> = { status: 'active' };
    if (filter?.unitId) where.unitId = filter.unitId;
    if (filter?.propertyId) where.propertyId = filter.propertyId;
    const limit = Math.min(Math.max(Number(filter?.limit) || 50, 1), 200);
    const offset = Math.max(Number(filter?.offset) || 0, 0);
    const [rows, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { rows, total, limit, offset };
  }

  async removeMeter(id: string): Promise<UtilityMeter> {
    const repo = this.tenant.getRepository(UtilityMeter);
    const meter = await repo.findOne({ where: { id } });
    if (!meter) throw new NotFoundException('Meter not found');
    // Removed, never deleted: its readings are the history of a real account.
    meter.status = 'removed';
    return repo.save(meter);
  }

  // ---------------- readings ----------------

  /** The reading immediately before `date` on this meter, if any. */
  private async previousReading(meterId: string, date: string): Promise<UtilityReading | null> {
    const repo = this.tenant.getRepository(UtilityReading);
    const rows = await repo
      .createQueryBuilder('r')
      .where('r.meter_id = :meterId', { meterId })
      .andWhere('r.reading_date < :date', { date })
      .orderBy('r.reading_date', 'DESC')
      .limit(1)
      .getMany();
    return rows[0] ?? null;
  }

  async captureReading(input: CaptureReadingInput, capturedByUserId?: string): Promise<UtilityReading> {
    const meters = this.tenant.getRepository(UtilityMeter);
    const meter = await meters.findOne({ where: { id: input.meterId } });
    if (!meter) throw new NotFoundException('Meter not found');
    if (meter.status !== 'active') {
      throw new BadRequestException('That meter has been removed; capture against its replacement');
    }
    if (!input.readingDate || Number.isNaN(Date.parse(input.readingDate))) {
      throw new BadRequestException('A reading needs a valid date');
    }

    const readings = this.tenant.getRepository(UtilityReading);

    // A later reading already exists: accepting this one would leave that one's
    // stored consumption measuring from the wrong baseline. Correct the later
    // reading instead of back-filling behind it.
    const laterCount = await readings
      .createQueryBuilder('r')
      .where('r.meter_id = :meterId', { meterId: meter.id })
      .andWhere('r.reading_date > :date', { date: input.readingDate })
      .getCount();
    if (laterCount > 0) {
      throw new BadRequestException(
        'A later reading already exists on this meter. Capture in date order, or correct the later reading.',
      );
    }

    const prev = await this.previousReading(meter.id, input.readingDate);

    const result = computeConsumption({
      metered: meter.metered,
      reading: input.reading,
      previousReading: prev?.reading !== undefined && prev?.reading !== null ? Number(prev.reading) : null,
      multiplier: Number(meter.multiplier ?? 1),
      rollover: !!input.rollover,
      dialDigits: meter.dialDigits ?? null,
    });
    if (isConsumptionError(result)) throw new BadRequestException(result.reason);

    const cost = deriveCost(result.consumption, input.tariffRate, input.cost);
    if (!meter.metered && (cost === null || cost === undefined)) {
      throw new BadRequestException('An unmetered service needs the cost for the period');
    }

    return readings.save(
      readings.create({
        vendorId: this.tenant.vendorId ?? undefined,
        meterId: meter.id,
        readingDate: input.readingDate,
        reading: meter.metered ? Number(input.reading) : null,
        consumption: result.consumption,
        rollover: !!input.rollover,
        estimated: !!input.estimated,
        tariffRate: input.tariffRate ?? null,
        cost,
        source: 'manual',
        capturedByUserId: capturedByUserId ?? null,
        media: input.media ?? [],
        note: input.note ?? null,
      }),
    );
  }

  // ---------------- the recovery gap ----------------

  /**
   * Per property, per utility, per month: the bulk reading against the sum of
   * the submeters under it. Two aggregates merged in memory rather than one
   * FULL OUTER JOIN, because a period can exist on either side alone and the
   * merge has to keep both — a property with a bulk reading and no submeter
   * readings is exactly the case an agency wants to see.
   *
   * Runs through the tenant manager, so RLS scopes it; the explicit vendor_id
   * predicate is belt and braces, not the isolation.
   */
  async recoveryGap(opts?: { propertyId?: string; from?: string; to?: string }): Promise<GapResult[]> {
    const vendorId = this.tenant.vendorId;
    const mgr = this.tenant.getManager();

    const params: unknown[] = [vendorId];
    let dateFilter = '';
    if (opts?.from) { params.push(opts.from); dateFilter += ` AND r.reading_date >= $${params.length}`; }
    if (opts?.to) { params.push(opts.to); dateFilter += ` AND r.reading_date <= $${params.length}`; }
    let propFilterBulk = '';
    let propFilterSub = '';
    if (opts?.propertyId) {
      params.push(opts.propertyId);
      propFilterBulk = ` AND m.property_id = $${params.length}`;
      propFilterSub = ` AND u.property_id = $${params.length}`;
    }

    const bulk = await mgr.query(
      `SELECT m.property_id AS "propertyId", m.kind AS kind,
              to_char(r.reading_date, 'YYYY-MM') AS period,
              SUM(r.consumption)::float8 AS "bulkConsumption",
              SUM(r.cost)::float8 AS "bulkCost"
         FROM utility_readings r
         JOIN utility_meters m ON m.id = r.meter_id
        WHERE r.vendor_id = $1 AND m.property_id IS NOT NULL
          AND r.deleted_at IS NULL AND m.deleted_at IS NULL${dateFilter}${propFilterBulk}
        GROUP BY 1, 2, 3`,
      params,
    );

    const sub = await mgr.query(
      `SELECT u.property_id AS "propertyId", m.kind AS kind,
              to_char(r.reading_date, 'YYYY-MM') AS period,
              SUM(r.consumption)::float8 AS "subConsumption",
              SUM(r.cost)::float8 AS "subCost",
              COUNT(DISTINCT m.id)::int AS "subMeters"
         FROM utility_readings r
         JOIN utility_meters m ON m.id = r.meter_id
         JOIN units u ON u.id = m.unit_id
        WHERE r.vendor_id = $1 AND m.unit_id IS NOT NULL
          AND r.deleted_at IS NULL AND m.deleted_at IS NULL${dateFilter}${propFilterSub}
        GROUP BY 1, 2, 3`,
      params,
    );

    const names: Record<string, string> = {};
    const props = await mgr.query(
      `SELECT id, name FROM properties WHERE vendor_id = $1 AND deleted_at IS NULL`,
      [vendorId],
    );
    for (const p of props) names[p.id] = p.name;

    const key = (r: { propertyId: string; kind: string; period: string }) =>
      `${r.propertyId}|${r.kind}|${r.period}`;
    const merged = new Map<string, GapRow>();
    const blank = (r: any): GapRow => ({
      propertyId: r.propertyId, propertyName: names[r.propertyId], kind: r.kind, period: r.period,
      bulkConsumption: null, bulkCost: null, subConsumption: null, subCost: null, subMeters: 0,
    });
    for (const b of bulk) {
      const row = merged.get(key(b)) ?? blank(b);
      row.bulkConsumption = b.bulkConsumption;
      row.bulkCost = b.bulkCost;
      merged.set(key(b), row);
    }
    for (const s of sub) {
      const row = merged.get(key(s)) ?? blank(s);
      row.subConsumption = s.subConsumption;
      row.subCost = s.subCost;
      row.subMeters = s.subMeters;
      merged.set(key(s), row);
    }

    return computeGaps([...merged.values()]).sort(
      (a, b) => b.period.localeCompare(a.period) || (a.propertyName ?? '').localeCompare(b.propertyName ?? '') || a.kind.localeCompare(b.kind),
    );
  }

  listReadings(meterId: string, limit = 50): Promise<UtilityReading[]> {
    const repo = this.tenant.getRepository(UtilityReading);
    return repo.find({
      where: { meterId },
      order: { readingDate: 'DESC' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
  }
}
