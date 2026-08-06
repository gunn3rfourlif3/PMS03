'use client';

// Brand constants + host parsing live in ./brand-shared (no 'use client') so the
// root layout can resolve the brand from the request Host header during SSR.
// This module keeps the browser-only helpers.
export type { Branding } from './brand-shared';
export {
  VENDOR_SLUG,
  PLATFORM_DOMAIN,
  DEFAULT_BRANDING,
  LOCARE_BRAND,
  brandKeyFromHost,
  isPlatformHostFor,
  brandForHost,
} from './brand-shared';

import { Branding, VENDOR_SLUG, PLATFORM_DOMAIN, brandKeyFromHost } from './brand-shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

// Resolve the brand key from the hostname so each subdomain loads its agency's
// theme: app.dantalan.co.za -> dantalan.co.za (matched via vendors.custom_domain).
// Falls back to VENDOR_SLUG when there's no usable hostname (SSR/localhost).
export function brandKey(): string {
  const host = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  return host ? brandKeyFromHost(host) : VENDOR_SLUG;
}

/** True when the current host is the Locare platform (not an agency). */
export function isPlatformHost(): boolean {
  return brandKey() === PLATFORM_DOMAIN;
}

export async function fetchBranding(slug: string): Promise<Branding> {
  const res = await fetch(`${API_BASE}/branding/${slug}`);
  if (!res.ok) throw new Error(`branding ${res.status}`);
  return res.json();
}

const SYSTEM_STACK =
  '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const HEADING_STACK =
  '"Sora", "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Push a resolved theme into CSS custom properties + inject the web font. */
export function applyTheme(b: Branding) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  const c = b.colors;
  r.setProperty('--brand', c.brand);
  r.setProperty('--onbrand', c.onBrand);
  r.setProperty('--tint', c.tint);
  r.setProperty('--accent', c.accent);
  r.setProperty('--ink', c.ink);
  r.setProperty('--muted', c.muted);
  r.setProperty('--line', c.line);
  r.setProperty('--bg', c.bg);
  r.setProperty('--card', c.card);
  r.setProperty('--danger', c.danger);
  r.setProperty('--dangerbg', c.dangerBg);
  r.setProperty('--success', c.success);

  const body = b.font.family && b.font.family !== 'System' ? `"${b.font.family}", ${SYSTEM_STACK}` : SYSTEM_STACK;
  const head = b.font.headingFamily && b.font.headingFamily !== 'System' ? `"${b.font.headingFamily}", ${SYSTEM_STACK}` : HEADING_STACK;
  r.setProperty('--font', body);
  r.setProperty('--font-heading', head);

  if (b.font.webUrl && !document.getElementById('brand-font')) {
    const link = document.createElement('link');
    link.id = 'brand-font'; link.rel = 'stylesheet'; link.href = b.font.webUrl;
    document.head.appendChild(link);
  }
  document.title = `${b.name} · Back-office`;
}
