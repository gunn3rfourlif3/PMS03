// Point at your PMS API. localhost works for web/iOS-sim; use 10.0.2.2 for the
// Android emulator or your LAN IP for a physical device (Expo Go).
// Set EXPO_PUBLIC_API_BASE (e.g. in eas.json / .env) for staging & production
// builds; the localhost default is only for local development.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000/api';

// Which vendor's white-label theme to load. In production this comes from the
// host/subdomain; in dev, set it here. Try 'demo' (teal) or 'rivonia' (navy).
export const VENDOR_SLUG = 'demo';
