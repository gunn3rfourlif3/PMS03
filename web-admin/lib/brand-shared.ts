// Brand resolution shared by SERVER and CLIENT code.
//
// This file must NOT be marked 'use client': the root layout (a server
// component) imports it to resolve the brand from the request's Host header.
// Without that, the server render falls back to DEFAULT_BRANDING and Next bakes
// "Property Manager" into the prerendered HTML for every host, including Locare.

export interface Branding {
  name: string;
  slug: string;
  tagline?: string;
  /** `markUrl` is a SQUARE mark for the tab/app icon; imageUrl/wordmarkUrl are wide. */
  logo: { text: string; imageUrl?: string; wordmarkUrl?: string; markUrl?: string };
  colors: {
    brand: string; onBrand: string; tint: string; accent: string;
    ink: string; muted: string; line: string; bg: string; card: string;
    danger: string; dangerBg: string; success: string;
  };
  font: { family: string; headingFamily: string; webUrl?: string };
  contact: { email?: string; phone?: string; website?: string; address?: string };
}

export const VENDOR_SLUG = process.env.NEXT_PUBLIC_VENDOR_SLUG ?? 'dantalan';

// The Locare platform domain. Hosts that resolve to this (locare.co.za,
// www./app. …) are the platform itself — not an agency — so they use the
// Locare brand rather than a vendor's.
export const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'locare.co.za';

const APP_LABELS = new Set(['tenant', 'landlord', 'app', 'www', 'rentals']);

/**
 * Resolve the brand key from a hostname (no `window` needed, so this works
 * during SSR): app.dantalan.co.za -> dantalan.co.za.
 * Strips a port if present, and falls back to VENDOR_SLUG for localhost/IPs.
 */
export function brandKeyFromHost(rawHost: string): string {
  const host = (rawHost || '').split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return VENDOR_SLUG;
  const labels = host.split('.');
  return labels.length > 2 && APP_LABELS.has(labels[0]) ? labels.slice(1).join('.') : host;
}

/** True when the given host is the Locare platform (not an agency). */
export function isPlatformHostFor(rawHost: string): boolean {
  return brandKeyFromHost(rawHost) === PLATFORM_DOMAIN;
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

/** The Locare platform brand, used on the platform domain (no vendor lookup). */
export const LOCARE_BRAND: Branding = {
  name: 'Locare', slug: 'locare', tagline: 'Property management, beautifully run.',
  // wordmarkUrl: a wide logo rendered at natural size (no tile/name) in the shell.
  logo: { text: 'Locare', wordmarkUrl: '/brand/locare-logo.svg' },
  colors: {
    brand: '#2D6A8F', onBrand: '#ffffff', tint: '#E7EEF3', accent: '#1E4A63',
    ink: '#121212', muted: '#6b7280', line: '#e5e7eb', bg: '#f6f7f9', card: '#ffffff',
    danger: '#993C1D', dangerBg: '#FAECE7', success: '#1D9E75',
  },
  font: { family: 'System', headingFamily: 'System' },
  contact: { email: 'hello@locare.co.za' },
};

/** Best brand for a host, known synchronously on the server (no API call). */
export function brandForHost(rawHost: string): Branding {
  return isPlatformHostFor(rawHost) ? LOCARE_BRAND : DEFAULT_BRANDING;
}
