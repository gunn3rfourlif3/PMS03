import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE, brandKey } from './config';

/** White-label theme contract (mirrors the backend Branding type). */
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

/** Bundled fallback so the app renders even if /branding is unreachable. */
export const DEFAULT_BRANDING: Branding = {
  name: 'Property Manager',
  slug: 'default',
  tagline: 'Rentals, managed.',
  logo: { text: 'Property Manager' },
  colors: {
    brand: '#0F6E56', onBrand: '#ffffff', tint: '#E1F5EE', accent: '#C9A227',
    ink: '#16181d', muted: '#6b7280', line: '#e5e7eb', bg: '#f6f7f6', card: '#ffffff',
    danger: '#993C1D', dangerBg: '#FAECE7', success: '#0F6E56',
  },
  font: { family: 'System', headingFamily: 'System' },
  contact: {},
};

/** Resolve a font family that will actually render on the current platform. */
export function fontFamily(t: Branding, heading = false): string | undefined {
  // Premium default typeface (loaded in App via expo-font). Custom vendor fonts
  // are a web feature; on native we always use the bundled premium family.
  // Display weight matches the marketing site and the social creatives,
  // where headings are set at 800 rather than 700.
  return heading ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_500Medium';
}

/** Blend two hex colours. RN has no color-mix, and the CTA ground is the
 *  brand mixed into a near-black navy, so the mix has to happen here. */
export function mixHex(a: string, b: string, amount: number): string {
  const h = (c: string) => {
    const v = c.replace('#', '');
    const f = v.length === 3 ? v.split('').map((x) => x + x).join('') : v;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = h(a); const [r2, g2, b2] = h(b);
  const m = (x: number, y: number) => Math.round(x * amount + y * (1 - amount));
  return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)]
    .map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** The homepage CTA's ground, tinted by whichever brand this build serves. */
export function ctaGradient(t: Branding): [string, string, string, string] {
  const b = t.colors.brand;
  return [
    mixHex(b, '#0C2331', 0.18),
    mixHex(b, '#123043', 0.26),
    mixHex(b, '#1A425A', 0.34),
    mixHex(b, '#102B3B', 0.16),
  ];
}

const ThemeContext = createContext<Branding>(DEFAULT_BRANDING);
export const useTheme = () => useContext(ThemeContext);

async function fetchBranding(slug: string): Promise<Branding> {
  const res = await fetch(`${API_BASE}/branding/${slug}`);
  if (!res.ok) throw new Error(`branding ${res.status}`);
  return res.json();
}

/** On web, inject the brand's web font stylesheet once. */
function injectWebFont(t: Branding) {
  if (Platform.OS !== 'web' || !t.font.webUrl) return;
  const id = 'brand-font';
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet'; link.href = t.font.webUrl;
  document.head.appendChild(link);
}

/**
 * Fetches the vendor theme at boot (before login) and provides it to the tree.
 * Renders nothing until resolved so the first paint is already branded.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Branding | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBranding(brandKey())
      .then((t) => { if (alive) { injectWebFont(t); setTheme(t); } })
      .catch(() => { if (alive) setTheme(DEFAULT_BRANDING); });
    return () => { alive = false; };
  }, []);

  if (!theme) return null; // brief splash; App shows a spinner around this
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
