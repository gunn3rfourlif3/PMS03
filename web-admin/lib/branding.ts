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
  // Set by the server from DEPLOYMENT_THEME, before this ever runs.
  const dark = document.documentElement.dataset.theme === 'dark';

  // The agency's own colours always apply — that is the whole point of a
  // white-label product.
  r.setProperty('--brand', c.brand);
  r.setProperty('--onbrand', c.onBrand);
  r.setProperty('--accent', c.accent);

  // SURFACES BELONG TO THE THEME, NOT TO THE BRANDING RECORD.
  //
  // Every record carries a full light palette — ink #16181d, bg #f6f7f6, card
  // #ffffff — and these are INLINE styles on :root, which outrank
  // `:root[data-theme="dark"]` in the cascade no matter how that block is
  // written. Setting them unconditionally repainted a dark deployment light
  // the instant the branding fetch resolved, which looked like the theme flag
  // being ignored rather than being overwritten a moment later.
  //
  // In dark, globals.css owns the surfaces and derives --tint from --brand.
  if (!dark) {
    r.setProperty('--tint', c.tint);
    r.setProperty('--ink', c.ink);
    r.setProperty('--muted', c.muted);
    r.setProperty('--line', c.line);
    r.setProperty('--bg', c.bg);
    r.setProperty('--card', c.card);
    r.setProperty('--danger', c.danger);
    r.setProperty('--dangerbg', c.dangerBg);
    r.setProperty('--success', c.success);
  }

  // Same rule for type: an agency that names a typeface gets it in either
  // theme, but 'System' must not overwrite the theme's own stack.
  const named = b.font.family && b.font.family !== 'System';
  const namedHead = b.font.headingFamily && b.font.headingFamily !== 'System';
  if (named) r.setProperty('--font', `"${b.font.family}", ${SYSTEM_STACK}`);
  else if (!dark) r.setProperty('--font', SYSTEM_STACK);
  if (namedHead) r.setProperty('--font-heading', `"${b.font.headingFamily}", ${SYSTEM_STACK}`);
  else if (!dark) r.setProperty('--font-heading', HEADING_STACK);

  if (b.font.webUrl && !document.getElementById('brand-font')) {
    const link = document.createElement('link');
    link.id = 'brand-font'; link.rel = 'stylesheet'; link.href = b.font.webUrl;
    document.head.appendChild(link);
  }
  document.title = `${b.name} · Back-office`;
}
