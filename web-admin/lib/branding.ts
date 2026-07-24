'use client';

export interface Branding {
  name: string;
  slug: string;
  tagline?: string;
  logo: { text: string; imageUrl?: string };
  colors: {
    brand: string; onBrand: string; tint: string; accent: string;
    ink: string; muted: string; line: string; bg: string; card: string;
    danger: string; dangerBg: string; success: string;
  };
  font: { family: string; headingFamily: string; webUrl?: string };
  contact: { email?: string; phone?: string; website?: string; address?: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';
export const VENDOR_SLUG = process.env.NEXT_PUBLIC_VENDOR_SLUG ?? 'dantalan';

// Resolve the brand key from the hostname so each subdomain loads its agency's
// theme: app.dantalan.co.za -> dantalan.co.za (matched via vendors.custom_domain).
// Falls back to VENDOR_SLUG when there's no usable hostname (SSR/localhost).
const APP_LABELS = new Set(['tenant', 'landlord', 'app', 'www', 'rentals']);
export function brandKey(): string {
  const host = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return VENDOR_SLUG;
  const labels = host.split('.');
  return labels.length > 2 && APP_LABELS.has(labels[0]) ? labels.slice(1).join('.') : host;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'Property Manager', slug: 'default', tagline: 'Rentals, managed.',
  logo: { text: 'Property Manager' },
  colors: {
    brand: '#0F6E56', onBrand: '#ffffff', tint: '#E1F5EE', accent: '#C9A227',
    ink: '#16181d', muted: '#6b7280', line: '#e5e7eb', bg: '#f6f7f6', card: '#ffffff',
    danger: '#993C1D', dangerBg: '#FAECE7', success: '#0F6E56',
  },
  font: { family: 'System', headingFamily: 'System' },
  contact: {},
};

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
