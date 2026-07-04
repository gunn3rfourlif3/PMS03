/**
 * White-label branding contract. A vendor stores a (partial) Branding blob in
 * vendors.config->'branding'; the public endpoint deep-merges it over
 * DEFAULT_BRANDING so every client always receives a complete, safe theme.
 */
export interface BrandColors {
  brand: string; // primary
  onBrand: string; // text/icons on a brand-colored surface
  tint: string; // pale brand wash (badges, chips)
  accent: string; // secondary accent
  ink: string; // primary text
  muted: string; // secondary text
  line: string; // hairline borders
  bg: string; // app background
  card: string; // card surface
  danger: string;
  dangerBg: string;
  success: string;
}

export interface BrandFont {
  family: string; // CSS/RN font family name
  headingFamily: string; // family for headings/logo
  webUrl?: string; // optional web font stylesheet to inject (e.g. Google Fonts)
}

export interface BrandContact {
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}

export interface Branding {
  name: string;
  slug: string;
  tagline?: string;
  logo: { text: string; imageUrl?: string };
  colors: BrandColors;
  font: BrandFont;
  contact: BrandContact;
}

/** Neutral fallback theme (teal). Vendors override any subset of this. */
export const DEFAULT_BRANDING: Branding = {
  name: 'Property Manager',
  slug: 'default',
  tagline: 'Rentals, managed.',
  logo: { text: 'Property Manager' },
  colors: {
    brand: '#0F6E56',
    onBrand: '#ffffff',
    tint: '#E1F5EE',
    accent: '#C9A227',
    ink: '#16181d',
    muted: '#6b7280',
    line: '#e5e7eb',
    bg: '#f6f7f6',
    card: '#ffffff',
    danger: '#993C1D',
    dangerBg: '#FAECE7',
    success: '#0F6E56',
  },
  font: {
    family: 'System',
    headingFamily: 'System',
  },
  contact: {},
};

/** Deep-merge a partial branding blob over the default. Arrays/scalars replace. */
export function mergeBranding(partial: Partial<Branding> | null | undefined): Branding {
  const p = partial ?? {};
  return {
    ...DEFAULT_BRANDING,
    ...p,
    logo: { ...DEFAULT_BRANDING.logo, ...(p.logo ?? {}) },
    colors: { ...DEFAULT_BRANDING.colors, ...(p.colors ?? {}) },
    font: { ...DEFAULT_BRANDING.font, ...(p.font ?? {}) },
    contact: { ...DEFAULT_BRANDING.contact, ...(p.contact ?? {}) },
  };
}
