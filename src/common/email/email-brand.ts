import { DataSource, EntityManager } from 'typeorm';
import { mergeBranding } from '@modules/branding/branding.types';

/** The subset of a vendor's branding that an email can actually carry. */
export interface EmailBrand {
  agencyName?: string;
  brandColor?: string;
  logoUrl?: string;
  markUrl?: string;
}

/** Where the fallback mark is served from. Empty in dev unless configured. */
export const emailMarkBase = (): string | undefined =>
  process.env.PUBLIC_API_BASE?.replace(/\/+$/, '') || undefined;

/**
 * Only these survive the trip. Gmail and Outlook drop SVG outright, and a
 * relative or http:// URL is either unresolvable from the recipient's client or
 * blocked as mixed content — in both cases the recipient sees a broken-image
 * icon where the agency's mark should be, which looks worse than no logo at
 * all. Anything that doesn't qualify falls back to the wordmark.
 */
const MAIL_SAFE_LOGO = /^https:\/\/\S+\.(png|jpe?g|gif)(\?\S*)?$/i;

export function mailSafeLogo(raw?: string): string | undefined {
  if (!raw) return undefined;
  return MAIL_SAFE_LOGO.test(raw.trim()) ? raw.trim() : undefined;
}

/**
 * Resolve a vendor's branding for outgoing mail.
 *
 * Reads the same `vendors.config->'branding'` blob the apps theme from, so an
 * agency that sets its logo and colour once in Branding settings gets branded
 * email for free. Never throws: a missing vendor or malformed blob degrades to
 * the neutral default rather than blocking a rent invoice from going out.
 */
export async function emailBrandForVendor(
  db: DataSource | EntityManager,
  vendorId: string | null | undefined,
): Promise<EmailBrand> {
  if (!vendorId) return { markUrl: emailMarkBase() };
  try {
    const rows = await db.query(
      `SELECT name, config->'branding' AS branding FROM vendors WHERE id = $1`,
      [vendorId],
    );
    const row = rows?.[0];
    if (!row) return { markUrl: emailMarkBase() };

    const raw = typeof row.branding === 'string' ? JSON.parse(row.branding) : row.branding;
    const b = mergeBranding({ name: row.name, ...(raw ?? {}) });

    return {
      agencyName: b.name,
      brandColor: b.colors?.brand,
      logoUrl: mailSafeLogo(b.logo?.imageUrl),
      markUrl: emailMarkBase(),
    };
  } catch {
    return { markUrl: emailMarkBase() };
  }
}
