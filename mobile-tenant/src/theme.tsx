import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE, VENDOR_SLUG } from './config';

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
  return heading ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium';
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
    fetchBranding(VENDOR_SLUG)
      .then((t) => { if (alive) { injectWebFont(t); setTheme(t); } })
      .catch(() => { if (alive) setTheme(DEFAULT_BRANDING); });
    return () => { alive = false; };
  }, []);

  if (!theme) return null; // brief splash; App shows a spinner around this
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
