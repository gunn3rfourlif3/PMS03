import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Branding, mergeBranding } from './branding.types';

/**
 * Public branding resolution. No auth / no tenant context: a SECURITY DEFINER
 * function looks up an active vendor by slug (or custom domain) and returns its
 * stored branding blob, which we merge over DEFAULT_BRANDING so clients always
 * get a complete theme.
 */
@Injectable()
export class BrandingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(slug: string): Promise<Branding> {
    const rows = await this.dataSource.query('SELECT public_branding($1) AS b', [slug]);
    const row = rows[0]?.b;
    if (!row) throw new NotFoundException(`No brand for "${slug}"`);
    const stored = typeof row === 'string' ? JSON.parse(row) : row;
    // The function returns { name, slug, branding }. Name/slug seed the merged theme.
    const partial = {
      name: stored.name,
      slug: stored.slug,
      logo: { text: stored.name },
      ...(stored.branding ?? {}),
    };
    return mergeBranding(partial);
  }
}
