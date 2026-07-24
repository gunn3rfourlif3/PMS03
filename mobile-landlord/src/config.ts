// Point at your PMS API. localhost works for web/iOS-sim; use 10.0.2.2 for the
// Android emulator or your LAN IP for a physical device (Expo Go).
// Set EXPO_PUBLIC_API_BASE (e.g. in eas.json / .env) for staging & production
// builds; the localhost default is only for local development.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

// Native fallback (no hostname available off-web). On web the brand is resolved
// from the hostname — see brandKey() below.
export const VENDOR_SLUG = process.env.EXPO_PUBLIC_VENDOR_SLUG ?? 'dantalan';

// App-role subdomains that are NOT vendor keys; strip them to get the agency's
// domain (e.g. landlord.dantalan.co.za -> dantalan.co.za), which the backend
// resolves via vendors.custom_domain. Off-web falls back to VENDOR_SLUG.
const APP_LABELS = new Set(['tenant', 'landlord', 'app', 'www', 'rentals']);
export function brandKey(): string {
  const host =
    typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return VENDOR_SLUG;
  const labels = host.split('.');
  return labels.length > 2 && APP_LABELS.has(labels[0]) ? labels.slice(1).join('.') : host;
}
