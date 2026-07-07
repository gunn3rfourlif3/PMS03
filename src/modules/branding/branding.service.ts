import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { Branding, mergeBranding } from './branding.types';

/**
 * Branding resolution + self-service editing.
 *
 * resolve(slug): PUBLIC. No auth/tenant context - a SECURITY DEFINER function
 *   looks up an active vendor by slug/custom domain and returns its stored
 *   branding, merged over DEFAULT_BRANDING.
 *
 * getSettings()/updateSettings(): AUTHENTICATED. Read/write the CURRENT vendor's
 *   branding via the RLS-scoped manager (vendors is restricted to id = the
 *   caller's vendor), so a vendor can only ever edit its own theme.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly tenant: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async resolve(slug: string): Promise<Branding> {
    const rows = await this.dataSource.query('SELECT public_branding($1) AS b', [slug]);
    const row = rows[0]?.b;
    if (!row) throw new NotFoundException(`No brand for "${slug}"`);
    const stored = typeof row === 'string' ? JSON.parse(row) : row;
    return this.compose(stored.name, stored.slug, stored.branding);
  }

  /** Current vendor's branding (for the settings form). */
  async getSettings(): Promise<Branding> {
    const rows = await this.tenant.getManager().query(
      'SELECT name, slug, config FROM vendors WHERE id = $1',
      [this.tenant.vendorId],
    );
    const v = rows[0];
    if (!v) throw new NotFoundException('Vendor not found');
    const config = typeof v.config === 'string' ? JSON.parse(v.config) : (v.config ?? {});
    return this.compose(v.name, v.slug, config.branding);
  }

  /** Merge a partial branding blob over what's stored, persist, return the theme. */
  async updateSettings(partial: Partial<Branding>): Promise<Branding> {
    const rows = await this.tenant.getManager().query(
      'SELECT config FROM vendors WHERE id = $1',
      [this.tenant.vendorId],
    );
    if (rows.length === 0) throw new NotFoundException('Vendor not found');
    const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : (rows[0].config ?? {});
    const existing = config.branding ?? {};

    const next = {
      ...existing,
      ...('tagline' in partial ? { tagline: partial.tagline } : {}),
      logo: { ...(existing.logo ?? {}), ...(partial.logo ?? {}) },
      colors: { ...(existing.colors ?? {}), ...(partial.colors ?? {}) },
      font: { ...(existing.font ?? {}), ...(partial.font ?? {}) },
      contact: { ...(existing.contact ?? {}), ...(partial.contact ?? {}) },
    };

    await this.tenant.getManager().query(
      `UPDATE vendors
         SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('branding', $1::jsonb),
             updated_at = now()
       WHERE id = $2`,
      [JSON.stringify(next), this.tenant.vendorId],
    );
    return this.getSettings();
  }

  private compose(name: string, slug: string, branding: any): Branding {
    return mergeBranding({
      name,
      slug,
      logo: { text: name, ...(branding?.logo ?? {}) },
      ...(branding ?? {}),
    });
  }
}
