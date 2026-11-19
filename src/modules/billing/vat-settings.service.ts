import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { vatApplies } from './invoice-calc';

/** Stored at vendors.config.invoicing. Absent means every option off. */
export interface InvoicingSettings {
  /** Add the unit's unbilled submeter readings to each rent invoice, at cost. */
  billUtilities: boolean;
}

/** Stored at vendors.config.vat. Absent means not registered. */
export interface VatSettings {
  registered: boolean;
  number?: string;
}

/**
 * The agency's VAT registration, and whether it applies to a given lease.
 * Read and written through the RLS-scoped manager, so an agency only ever sees
 * or changes its own (same pattern as BrandingService.updateSettings).
 */
@Injectable()
export class VatSettingsService {
  constructor(private readonly tenant: TenantContextService) {}

  async get(): Promise<VatSettings> {
    const rows = await this.tenant.getManager().query(
      `SELECT config->'vat' AS vat FROM vendors WHERE id = $1`,
      [this.tenant.vendorId],
    );
    if (rows.length === 0) throw new NotFoundException('Vendor not found');
    return normalise(rows[0].vat);
  }

  async update(body: Partial<VatSettings>): Promise<VatSettings> {
    const current = await this.get();
    const registered = body.registered === undefined ? current.registered : body.registered === true;
    const number = body.number === undefined ? current.number : String(body.number ?? '').replace(/\s+/g, '');
    // SA VAT numbers are 10 digits starting with 4. Checked only when one is
    // given: a registered agency without a number is allowed (they may be
    // mid-registration), but a malformed one would print on tax invoices.
    if (number && !/^4\d{9}$/.test(number)) {
      throw new BadRequestException('A South African VAT number is 10 digits starting with 4.');
    }
    const next: VatSettings = { registered, ...(number ? { number } : {}) };
    await this.tenant.getManager().query(
      `UPDATE vendors
          SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('vat', $1::jsonb),
              updated_at = now()
        WHERE id = $2`,
      [JSON.stringify(next), this.tenant.vendorId],
    );
    return next;
  }

  async getInvoicing(): Promise<InvoicingSettings> {
    const rows = await this.tenant.getManager().query(
      `SELECT config->'invoicing' AS inv FROM vendors WHERE id = $1`,
      [this.tenant.vendorId],
    );
    if (rows.length === 0) throw new NotFoundException('Vendor not found');
    return normaliseInvoicing(rows[0].inv);
  }

  async updateInvoicing(body: Partial<InvoicingSettings>): Promise<InvoicingSettings> {
    const next: InvoicingSettings = { billUtilities: body.billUtilities === true };
    await this.tenant.getManager().query(
      `UPDATE vendors
          SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('invoicing', $1::jsonb),
              updated_at = now()
        WHERE id = $2`,
      [JSON.stringify(next), this.tenant.vendorId],
    );
    return next;
  }

  /**
   * What a rent invoice for this lease must include: whether VAT applies (and
   * the number to print), and whether utilities are billed on it.
   */
  async forLease(leaseId: string): Promise<{ applies: boolean; vatNumber?: string; billUtilities: boolean; unitId?: string }> {
    const rows = await this.tenant.getManager().query(
      `SELECT v.config->'vat' AS vat, v.config->'invoicing' AS inv, l.unit_id AS "unitId", p.attributes AS attributes
         FROM leases l
         JOIN units u ON u.id = l.unit_id
         JOIN properties p ON p.id = u.property_id
         JOIN vendors v ON v.id = l.vendor_id
        WHERE l.id = $1`,
      [leaseId],
    );
    const row = rows[0];
    if (!row) return { applies: false, billUtilities: false };
    const vat = normalise(row.vat);
    const attrs = typeof row.attributes === 'string' ? JSON.parse(row.attributes) : row.attributes;
    const applies = vatApplies(vat, attrs);
    const billUtilities = normaliseInvoicing(row.inv).billUtilities;
    return {
      applies,
      ...(applies && vat.number ? { vatNumber: vat.number } : {}),
      billUtilities,
      unitId: row.unitId,
    };
  }
}

function normaliseInvoicing(raw: unknown): InvoicingSettings {
  const v = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<InvoicingSettings> | null;
  return { billUtilities: v?.billUtilities === true };
}

function normalise(raw: unknown): VatSettings {
  const v = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<VatSettings> | null;
  return { registered: v?.registered === true, ...(v?.number ? { number: String(v.number) } : {}) };
}
