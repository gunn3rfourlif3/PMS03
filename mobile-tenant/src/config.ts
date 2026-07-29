// Point this at your running PMS API.
// - iOS simulator / web:      http://localhost:3000/api
// - Android emulator:         http://10.0.2.2:3000/api
// - Physical device (Expo Go): http://<your-computer-LAN-IP>:3000/api
// Set EXPO_PUBLIC_API_BASE (e.g. in eas.json / .env) for staging & production
// builds; the localhost default is only for local development.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

// Native fallback (no hostname available off-web). On web the brand is resolved
// from the hostname — see brandKey() below.
export const VENDOR_SLUG = process.env.EXPO_PUBLIC_VENDOR_SLUG ?? 'dantalan';

// App-role subdomains that are NOT vendor keys; strip them to get the agency's
// domain (e.g. tenant.dantalan.co.za -> dantalan.co.za), which the backend
// resolves via vendors.custom_domain. Off-web falls back to VENDOR_SLUG.
const APP_LABELS = new Set(['tenant', 'landlord', 'app', 'www', 'rentals']);
export function brandKey(): string {
  const host =
    typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return VENDOR_SLUG;
  const labels = host.split('.');
  return labels.length > 2 && APP_LABELS.has(labels[0]) ? labels.slice(1).join('.') : host;
}

// Idle auto-logout window (minutes). Keep in sync with the API's
// SESSION_IDLE_MINUTES. Default 10.
export const IDLE_TIMEOUT_MINUTES = Math.max(1, Number(process.env.EXPO_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 10));
