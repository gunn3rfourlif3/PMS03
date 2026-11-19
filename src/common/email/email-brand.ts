import { DataSource, EntityManager } from 'typeorm';
import { mergeBranding } from '@modules/branding/branding.types';

/** The subset of a vendor's branding that an email can actually carry. */
export interface EmailBrand {
  agencyName?: string;
  brandColor?: string;
  logoUrl?: string;
  markUrl?: string;
  /** From Branding settings → Contact. Printed in the email footer. */
  contact?: { email?: string; phone?: string; address?: string };
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
      contact: { email: b.contact?.email, phone: b.contact?.phone, address: b.contact?.address },
    };
  } catch {
    return { markUrl: emailMarkBase() };
  }
}

/**
 * Who an agency's email is FROM: the agency's name over the platform's sending
 * address, with replies going to the agency.
 *
 * The address stays the platform's own because that is the domain SPF, DKIM
 * and DMARC are set up for — putting an agency's domain in From without
 * those records gets the mail junked or rejected. The display name is what a
 * tenant reads in their inbox, and before this it was one global
 * SMTP_FROM_NAME: every agency's tenants saw the same sender. Reply-To is the
 * agency's contact email, so a tenant answering an invoice reaches the agency,
 * not a no-reply box.
 *
 * Platform mail (sign-in codes, partner and changelog emails) does not use
 * this: it is Locare speaking, and keeps the platform sender.
 */
export function agencySender(brand: Pick<EmailBrand, 'agencyName' | 'contact'>): {
  from?: { email: string; name: string };
  replyTo?: { email: string; name?: string };
} {
  const address = process.env.SMTP_FROM ?? process.env.SENDGRID_FROM ?? 'no-reply@locare.co.za';
  // A display name is a header: strip what could break out of it.
  const name = (brand.agencyName ?? '').replace(/["<>\r\n\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64);
  const reply = (brand.contact?.email ?? '').trim();
  return {
    ...(name ? { from: { email: address, name } } : {}),
    ...(/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(reply) ? { replyTo: { email: reply, ...(name ? { name } : {}) } } : {}),
  };
}
