import { NextRequest } from 'next/server';
import { brandKeyFromHost, isPlatformHostFor, LOCARE_BRAND, DEFAULT_BRANDING } from '@/lib/brand-shared';

/**
 * Per-host favicon.
 *
 * The obvious implementation — drop a `favicon.ico` in `app/` — would put
 * Locare's mark in the browser tab of every agency's back-office. Tenants and
 * owners never see Locare anywhere else in this product; the tab is the one
 * place that leak would go unnoticed for months.
 *
 * So the icon resolves from the Host header, exactly like the rest of the
 * branding (lib/brand-shared.ts):
 *   - the platform host serves the real Locare mark
 *   - an agency host serves a mark generated from that agency's own brand
 *     colour and initial, fetched from the API's public branding endpoint
 *
 * Generated rather than uploaded, deliberately: an agency that has set a logo
 * and a brand colour should get a correct favicon without being asked for a
 * 32×32 file they do not have. If they later upload a square mark, this is the
 * one place to start preferring it.
 */
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

/** Never let a slow branding lookup hold up a favicon. */
const LOOKUP_TIMEOUT_MS = 1500;

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** First letter that will actually render. Falls back rather than drawing a box. */
function initialOf(name: string): string {
  const ch = (name || '').match(/[\p{L}\p{N}]/u)?.[0];
  return (ch ?? 'P').toUpperCase();
}

/**
 * A rounded tile with the brand initial. Kept to plain shapes and one text
 * node so it stays legible at 16px, where anything more detailed turns to mud.
 */
function markSvg(letter: string, bg: string, fg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<rect width="32" height="32" rx="7" fill="${xmlEscape(bg)}"/>` +
    `<text x="16" y="17" text-anchor="middle" dominant-baseline="central"` +
    ` font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"` +
    ` font-size="19" font-weight="700" fill="${xmlEscape(fg)}">${xmlEscape(letter)}</text></svg>`;
}

/**
 * A vendor-supplied mark URL is agency-controlled input that we would be
 * redirecting to from our own origin, so restrict it to https (or a
 * same-origin path) rather than following whatever was typed into a settings
 * field. An open redirect on a favicon is minor; it is also free to prevent.
 */
function safeMarkUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const url = raw.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

interface AgencyMark {
  name: string;
  brand: string;
  onBrand: string;
  markUrl?: string;
}

async function agencyBrand(slug: string): Promise<AgencyMark> {
  const fallback = {
    name: DEFAULT_BRANDING.name,
    brand: DEFAULT_BRANDING.colors.brand,
    onBrand: DEFAULT_BRANDING.colors.onBrand,
  };
  try {
    const res = await fetch(`${API_BASE}/branding/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    const b = await res.json();
    return {
      name: b?.name || fallback.name,
      brand: b?.colors?.brand || fallback.brand,
      onBrand: b?.colors?.onBrand || fallback.onBrand,
      // Only `markUrl` — never `imageUrl`. A wide header logo scaled into a
      // 16px square is mud; the generated tile is the better fallback.
      markUrl: safeMarkUrl(b?.logo?.markUrl),
    };
  } catch {
    // A favicon is never worth a 500. Neutral mark and move on.
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  let body: string;
  if (isPlatformHostFor(host)) {
    // The platform gets the real mark, not a generated letter.
    const res = await fetch(new URL('/brand/locare-mark.svg', req.nextUrl.origin), { cache: 'force-cache' })
      .catch(() => null);
    body = res?.ok
      ? await res.text()
      : markSvg(initialOf(LOCARE_BRAND.name), LOCARE_BRAND.colors.brand, LOCARE_BRAND.colors.onBrand);
  } else {
    const b = await agencyBrand(brandKeyFromHost(host));
    if (b.markUrl) {
      // Hand the browser straight to the agency's own asset rather than
      // proxying the bytes through here on every tab.
      return Response.redirect(new URL(b.markUrl, req.nextUrl.origin), 307);
    }
    body = markSvg(initialOf(b.name), b.brand, b.onBrand);
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Short enough that a branding change shows up the same day, long enough
      // that the API is not asked for a favicon on every page view. `private`
      // because the answer differs per host and must not be shared by a proxy.
      'Cache-Control': 'private, max-age=3600, must-revalidate',
    },
  });
}
