'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';
const KEY = 'pms_admin_token';

export const auth = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY)),
  set: (t: string) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

/** Decode the roles claim from the stored JWT (no verification — display only). */
export function rolesFromToken(): string[] {
  const t = auth.get();
  if (!t) return [];
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(payload.roles) ? payload.roles : [];
  } catch { return []; }
}
export const isOwner = () => rolesFromToken().includes('owner');

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
  income: (period: string) => req(`/reporting/income/${period}`),
  runBilling: (period: string, dueDate: string) =>
    req('/billing/run', { method: 'POST', body: JSON.stringify({ period, dueDate }) }),

  units: () => req('/properties/units'),
  listProperties: () => req('/properties'),
  createProperty: (b: any) => req('/properties', { method: 'POST', body: JSON.stringify(b) }),
  updateProperty: (id: string, b: any) => req(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteProperty: (id: string) => req(`/properties/${id}`, { method: 'DELETE' }),
  unitsForProperty: (propertyId: string) => req(`/properties/units?propertyId=${propertyId}`),
  createUnit: (propertyId: string, b: any) => req(`/properties/${propertyId}/units`, { method: 'POST', body: JSON.stringify(b) }),
  updateUnit: (id: string, b: any) => req(`/properties/units/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteUnit: (id: string) => req(`/properties/units/${id}`, { method: 'DELETE' }),
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
  ownerStatements: (ownerId: string) => req(`/owners/${ownerId}/statements`),

  listDocuments: (ownerType: string, ownerId: string) => req(`/documents?ownerType=${ownerType}&ownerId=${ownerId}`),
  docUploadUrl: (b: { ownerType: string; ownerId: string; type: string; filename: string; contentType: string }) =>
    req('/documents/upload-url', { method: 'POST', body: JSON.stringify(b) }),
  docConfirm: (id: string) => req(`/documents/${id}/confirm`, { method: 'POST' }),
  docDownloadUrl: (id: string) => req(`/documents/${id}/download-url`),
  requestSignature: (id: string, signerEmail: string, signerName?: string) =>
    req(`/documents/${id}/signature`, { method: 'POST', body: JSON.stringify({ signerEmail, signerName }) }),

  listInspections: () => req('/inspections'),
  createInspection: (b: { unitId: string; type: string; leaseId?: string }) =>
    req('/inspections', { method: 'POST', body: JSON.stringify(b) }),
  recordInspectionItems: (id: string, items: any[]) =>
    req(`/inspections/${id}/items`, { method: 'POST', body: JSON.stringify({ items }) }),
  signoffInspection: (id: string) => req(`/inspections/${id}/signoff`, { method: 'POST' }),

  listApiKeys: () => req('/api-keys'),
  createApiKey: (name: string, scopes: string[]) => req('/api-keys', { method: 'POST', body: JSON.stringify({ name, scopes }) }),
  revokeApiKey: (id: string) => req(`/api-keys/${id}/revoke`, { method: 'POST' }),
  listNotifications: () => req('/notifications'),
  listLeases: () => req('/leasing'),
  renewLease: (id: string, escalationPct: number, months: number) =>
    req(`/leasing/${id}/renew`, { method: 'POST', body: JSON.stringify({ escalationPct, months }) }),
  updateOwnerBanking: (id: string, banking: any) => req(`/owners/${id}/banking`, { method: 'PUT', body: JSON.stringify(banking) }),
  listProviders: (category?: string) => req(`/service-providers${category ? `?category=${category}` : ''}`),
  createProvider: (b: any) => req('/service-providers', { method: 'POST', body: JSON.stringify(b) }),
  updateProvider: (id: string, b: any) => req(`/service-providers/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  setProviderStatus: (id: string, status: string) => req(`/service-providers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  generateStatement: (ownerId: string, period: string) =>
    req(`/owners/${ownerId}/statements/${period}`, { method: 'POST' }),
  payoutStatement: (statementId: string) =>
    req(`/owners/statements/${statementId}/payout`, { method: 'POST' }),

  portalSummary: () => req('/portal/summary'),
  portalProperties: () => req('/portal/properties'),
  portalStatements: () => req('/portal/statements'),
  portalBanking: () => req('/portal/banking'),
  updatePortalBanking: (b: any) => req('/portal/banking', { method: 'PUT', body: JSON.stringify(b) }),

  messageInbox: () => req('/messages/inbox'),
  messageThread: (id: string) => req(`/messages/conversations/${id}`),
  messageReply: (id: string, body: string) => req(`/messages/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  messageSetStatus: (id: string, status: 'open' | 'closed') => req(`/messages/conversations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  messageUnread: () => req('/messages/unread-count'),

  brandingSettings: () => req('/settings/branding'),
  updateBranding: (body: any) => req('/settings/branding', { method: 'PUT', body: JSON.stringify(body) }),
};
