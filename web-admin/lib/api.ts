'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';
const KEY = 'pms_admin_token';

export const auth = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY)),
  set: (t: string) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

async function req(path: string, opts: RequestInit = {}): Promise<any> {
  const token = auth.get();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  requestOtp: (destination: string) =>
    req('/auth/otp/request', { method: 'POST', body: JSON.stringify({ destination }) }),
  verifyOtp: (destination: string, code: string) =>
    req('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ destination, code }) }),

  rentRoll: () => req('/reporting/rent-roll'),
  arrears: () => req('/reporting/arrears'),
  collection: (period: string) => req(`/reporting/collection/${period}`),
  runBilling: (period: string, dueDate: string) =>
    req('/billing/run', { method: 'POST', body: JSON.stringify({ period, dueDate }) }),

  units: () => req('/properties/units'),
  publishedListings: () => req('/listings/published'),
  allListings: () => req('/listings'),
  createListing: (b: { unitId: string; advertisedRent: number; availableFrom: string; description?: string }) =>
    req('/listings', { method: 'POST', body: JSON.stringify(b) }),
  publishListing: (id: string) => req(`/listings/${id}/publish`, { method: 'POST' }),

  applications: () => req('/listings/applications'),
  screenApplication: (id: string, b: { monthlyIncome?: number; creditScore?: number }) =>
    req(`/listings/applications/${id}/screen`, { method: 'POST', body: JSON.stringify(b) }),
  approveApplication: (id: string, startDate: string) =>
    req(`/listings/applications/${id}/approve`, { method: 'POST', body: JSON.stringify({ startDate }) }),
  rejectApplication: (id: string) =>
    req(`/listings/applications/${id}/reject`, { method: 'POST' }),

  owners: () => req('/owners'),
  createOwner: (b: { name: string; managementFeePct?: number }) =>
    req('/owners', { method: 'POST', body: JSON.stringify(b) }),
  generateStatement: (ownerId: string, period: string) =>
    req(`/owners/${ownerId}/statements/${period}`, { method: 'POST' }),
  payoutStatement: (statementId: string) =>
    req(`/owners/statements/${statementId}/payout`, { method: 'POST' }),
};
