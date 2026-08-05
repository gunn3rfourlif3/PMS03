'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api';
const KEY = 'pms_admin_token';
const DEVICE_KEY = 'pms_admin_device';

export const auth = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY)),
  set: (t: string) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

/** The "remember this device" token (survives sign-out only if kept). */
export const device = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(DEVICE_KEY)),
  set: (t: string) => window.localStorage.setItem(DEVICE_KEY, t),
  clear: () => (typeof window === 'undefined' ? undefined : window.localStorage.removeItem(DEVICE_KEY)),
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
export const isPartner = () => rolesFromToken().includes('partner');
export const isPlatformAdmin = () => rolesFromToken().includes('platform_admin');

/** The impersonation actor from the stored JWT, or null when not impersonating. */
export function actorFromToken(): { email: string; agency: string } | null {
  const t = auth.get();
  if (!t) return null;
  try {
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return p.act ? { email: p.act.email as string, agency: p.act.agency as string } : null;
  } catch { return null; }
}
/** Where a login lands, by role. */
export const homeForRole = () =>
  isPlatformAdmin() ? '/admin/partners'
    : isPartner() ? '/partner'
    : isOwner() ? '/portal'
    : rolesFromToken().length ? '/'
    : '/no-access';

/** SSE stream URL for live message updates (token in query — EventSource can't set headers). */
export const messageStreamUrl = () => `${API_BASE}/messages/stream?token=${encodeURIComponent(auth.get() ?? '')}`;

/** An authenticated request came back 401 → the session is gone; boot to login. */
function handleUnauthorized(status: number, hadToken: boolean) {
  if (status !== 401 || !hadToken) return false;
  auth.clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
  return true;
}

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
  if (handleUnauthorized(res.status, !!token)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Multipart upload (no JSON Content-Type — the browser sets the boundary). */
async function reqForm(path: string, form: FormData): Promise<any> {
  const token = auth.get();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (handleUnauthorized(res.status, !!token)) throw new Error('Your session has expired. Please sign in again.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(msg || `Upload failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function fileForm(file: File): FormData { const f = new FormData(); f.append('file', file); return f; }

/** Derive the thumbnail URL for a stored image (server writes <id>_thumb.<ext>). */
export function thumbUrl(url: string): string {
  return url ? url.replace(/\.([a-zA-Z0-9]+)(\?.*)?$/, '_thumb.$1$2') : url;
}

export const api = {
  // Media / photos
  uploadMedia: (file: File): Promise<{ key: string; url: string }> => reqForm('/media', fileForm(file)),
  addListingPhoto: (id: string, file: File): Promise<string[]> => reqForm(`/listings/${id}/media`, fileForm(file)),
  removeListingPhoto: (id: string, url: string): Promise<string[]> =>
    req(`/listings/${id}/media`, { method: 'DELETE', body: JSON.stringify({ url }) }),

  requestOtp: (destination: string) =>
    req('/auth/otp/request', { method: 'POST', body: JSON.stringify({ destination }) }),
  verifyOtp: async (destination: string, code: string, remember?: boolean) => {
    const r = await req('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ destination, code, remember }) });
    if (r?.deviceToken) device.set(r.deviceToken);
    return r as { accessToken: string; idleMinutes: number };
  },
  /** Silent re-auth from a remembered device — returns null if there's no/expired token. */
  deviceLogin: async (): Promise<{ accessToken: string } | null> => {
    const dt = device.get();
    if (!dt) return null;
    try {
      const r = await req('/auth/device/login', { method: 'POST', body: JSON.stringify({ deviceToken: dt }) });
      if (r?.deviceToken) device.set(r.deviceToken); // rotated
      return r;
    } catch { device.clear(); return null; }
  },
  googleEnabled: (): Promise<{ enabled: boolean }> => req('/auth/google/enabled'),
  googleStartUrl: (origin: string) => `${API_BASE}/auth/google/start?origin=${encodeURIComponent(origin)}`,
  exchangeGoogleCode: (otc: string): Promise<{ accessToken: string; idleMinutes: number }> =>
    req('/auth/google/exchange', { method: 'POST', body: JSON.stringify({ otc }) }),
  refreshSession: (): Promise<{ accessToken: string; idleMinutes: number }> =>
    req('/auth/refresh', { method: 'POST' }),
  logout: (): Promise<{ ok: true }> => {
    const dt = device.get();
    device.clear();
    return req('/auth/logout', { method: 'POST', body: JSON.stringify({ deviceToken: dt }) });
  },

  // Platform-admin agency impersonation
  listAgencies: (): Promise<Array<{ vendorId: string; name: string; slug: string; status: string }>> =>
    req('/admin/agencies'),
  impersonate: (vendorId: string, reason?: string): Promise<{ accessToken: string; agency: { id: string; name: string } }> =>
    req('/admin/impersonate', { method: 'POST', body: JSON.stringify({ vendorId, reason }) }),
  stopImpersonation: (): Promise<{ accessToken: string }> =>
    req('/auth/impersonate/stop', { method: 'POST' }),
  impersonationEvents: (): Promise<Array<{ id: string; adminEmail: string; agency: string; reason?: string; startedAt: string; endedAt?: string }>> =>
    req('/admin/impersonation-events'),

  rentRoll: () => req('/reporting/rent-roll'),
  arrears: () => req('/reporting/arrears'),
  collection: (period: string) => req(`/reporting/collection/${period}`),
  income: (period: string) => req(`/reporting/income/${period}`),
  runBilling: (period: string, dueDate: string) =>
    req('/billing/run', { method: 'POST', body: JSON.stringify({ period, dueDate }) }),

  // Proof of payment (manual EFT) review
  listProofs: (status?: string) => req(`/proof-of-payment${status ? `?status=${status}` : ''}`),
  acceptProof: (id: string) => req(`/proof-of-payment/${id}/accept`, { method: 'POST' }),
  rejectProof: (id: string, reason?: string) =>
    req(`/proof-of-payment/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

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
  createListing: (b: { unitId: string; advertisedRent: number; availableFrom: string; description?: string; deposit?: number; adminFee?: number }) =>
    req('/listings', { method: 'POST', body: JSON.stringify(b) }),
  publishListing: (id: string) => req(`/listings/${id}/publish`, { method: 'POST' }),
  setListingStatus: (id: string, status: 'draft' | 'published' | 'paused' | 'closed') =>
    req(`/listings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Public rentals site (no auth) — used by rentals.<domain>
  publicListings: (vendor: string) => req(`/listings/public?vendor=${encodeURIComponent(vendor)}`),
  publicListing: (id: string) => req(`/listings/public/${id}`),
  applyToListing: (b: { listingId: string; applicantName: string; applicantEmail: string; applicantPhone?: string; details?: Record<string, unknown> }) =>
    req('/listings/applications', { method: 'POST', body: JSON.stringify(b) }),

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
  addTenant: (b: { name: string; email: string; phone?: string; unitId: string; rentAmount: number; startDate: string; endDate?: string; referredByAgentId?: string }) =>
    req('/leasing/tenants', { method: 'POST', body: JSON.stringify(b) }),
  renewLease: (id: string, escalationPct: number, months: number) =>
    req(`/leasing/${id}/renew`, { method: 'POST', body: JSON.stringify({ escalationPct, months }) }),
  updateOwnerBanking: (id: string, banking: any) => req(`/owners/${id}/banking`, { method: 'PUT', body: JSON.stringify(banking) }),
  ownerBanking: (id: string) => req(`/owners/${id}/banking`),
  listProviders: (category?: string) => req(`/service-providers${category ? `?category=${category}` : ''}`),
  createProvider: (b: any) => req('/service-providers', { method: 'POST', body: JSON.stringify(b) }),
  updateProvider: (id: string, b: any) => req(`/service-providers/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  setProviderStatus: (id: string, status: string) => req(`/service-providers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  generateStatement: (ownerId: string, period: string) =>
    req(`/owners/${ownerId}/statements/${period}`, { method: 'POST' }),
  payoutStatement: (statementId: string) =>
    req(`/owners/statements/${statementId}/payout`, { method: 'POST' }),

  // ── Subscription / billing (agency-facing) ──
  subscription: () => req('/subscription'),
  subscriptionInvoices: () => req('/subscription/invoices'),
  subscriptionCheckout: (id: string) => req(`/subscription/invoices/${id}/checkout`, { method: 'POST' }),
  adminSubInvoices: (status?: string) => req(`/admin/subscription-invoices${status ? `?status=${status}` : ''}`),
  runSubInvoices: (period?: string) => req('/admin/subscription-invoices/run', { method: 'POST', body: JSON.stringify({ period }) }),
  markSubInvoicePaid: (id: string, ref?: string) => req(`/admin/subscription-invoices/${id}/paid`, { method: 'POST', body: JSON.stringify({ ref }) }),
  voidSubInvoice: (id: string) => req(`/admin/subscription-invoices/${id}/void`, { method: 'POST' }),

  // ── Partner portal ──
  partnerOverview: () => req('/partner/overview'),
  partnerMe: () => req('/partner/me'),
  partnerAgencies: () => req('/partner/agencies'),
  partnerReferral: () => req('/partner/referral'),
  partnerLeaderboard: () => req('/partner/leaderboard'),
  onboardAgency: (b: { agencyName: string; slug?: string; ownerName: string; ownerEmail: string; expectedUnits?: number }) =>
    req('/partner/agencies', { method: 'POST', body: JSON.stringify(b) }),
  partnerDeals: () => req('/partner/deals'),
  createDeal: (b: any) => req('/partner/deals', { method: 'POST', body: JSON.stringify(b) }),
  updateDeal: (id: string, b: any) => req(`/partner/deals/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  moveDealStage: (id: string, stage: string, lostReason?: string) =>
    req(`/partner/deals/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage, lostReason }) }),
  partnerActivities: () => req('/partner/activities'),
  logPartnerActivity: (b: { type: string; summary?: string; dealId?: string }) =>
    req('/partner/activities', { method: 'POST', body: JSON.stringify(b) }),

  partnerCommissions: () => req('/partner/commissions'),
  partnerCommissionSummary: () => req('/partner/commissions/summary'),
  partnerBanking: () => req('/partner/banking'),
  updatePartnerBanking: (b: any) => req('/partner/banking', { method: 'PUT', body: JSON.stringify(b) }),

  // ── Platform admin: partners + commissions ──
  adminCommissions: (status?: string) => req(`/admin/commissions${status ? `?status=${status}` : ''}`),
  runCommissions: (period?: string) => req('/admin/commissions/run', { method: 'POST', body: JSON.stringify({ period }) }),
  approvePartnerCommission: (id: string) => req(`/admin/commissions/${id}/approve`, { method: 'POST' }),
  payPartnerCommission: (id: string, ref?: string) => req(`/admin/commissions/${id}/pay`, { method: 'POST', body: JSON.stringify({ ref }) }),
  cancelPartnerCommission: (id: string) => req(`/admin/commissions/${id}/cancel`, { method: 'POST' }),
  validateRef: (code: string) => req(`/partners/ref/${encodeURIComponent(code)}`),
  publicSignup: (b: { ref: string; agencyName: string; ownerName: string; ownerEmail: string }) => req('/partners/signup', { method: 'POST', body: JSON.stringify(b) }),
  adminSignups: () => req('/admin/signups'),
  approveSignup: (vendorId: string) => req(`/admin/signups/${vendorId}/approve`, { method: 'POST' }),
  adminPartners: () => req('/admin/partners'),
  createPartner: (b: any) => req('/admin/partners', { method: 'POST', body: JSON.stringify(b) }),
  setPartnerStatus: (id: string, status: string) => req(`/admin/partners/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  addPartnerMember: (id: string, email: string, name?: string) => req(`/admin/partners/${id}/members`, { method: 'POST', body: JSON.stringify({ email, name }) }),

  // ── Platform admin: partner vetting (KYC/KYB) applications ──
  partnerApplications: (status?: string) => req(`/admin/partner-applications${status ? `?status=${status}` : ''}`),
  partnerApplication: (id: string) => req(`/admin/partner-applications/${id}`),
  reviewPartnerApplication: (id: string) => req(`/admin/partner-applications/${id}/review`, { method: 'POST' }),
  approvePartnerApplication: (id: string, b: { commissionRate?: number; commissionMonths?: number }) =>
    req(`/admin/partner-applications/${id}/approve`, { method: 'POST', body: JSON.stringify(b) }),
  rejectPartnerApplication: (id: string, reason?: string) =>
    req(`/admin/partner-applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  requestInfoPartnerApplication: (id: string, note?: string) =>
    req(`/admin/partner-applications/${id}/request-info`, { method: 'POST', body: JSON.stringify({ note }) }),

  // ── Public: partner application (no auth) ──
  createPartnerApplication: (b: any): Promise<{ id: string; uploadToken: string }> =>
    req('/partner-applications', { method: 'POST', body: JSON.stringify(b) }),
  submitPartnerApplication: (id: string, token: string) =>
    req(`/partner-applications/${id}/submit`, { method: 'POST', body: JSON.stringify({ token }) }),
  uploadApplicationDoc: async (id: string, token: string, docType: string, file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('token', token);
    form.append('docType', docType);
    const res = await fetch(`${API_BASE}/partner-applications/${id}/documents`, { method: 'POST', body: form });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((Array.isArray(b.message) ? b.message.join(', ') : b.message) || `Upload failed (${res.status})`);
    }
    return res.json();
  },

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

  // Lease e-sign
  getLeaseToSign: (ref: string) => req(`/lease-agreements/sign/${ref}`),
  signLease: (ref: string, fullName: string) =>
    req(`/lease-agreements/sign/${ref}/complete`, { method: 'POST', body: JSON.stringify({ fullName }) }),
  leaseAgreements: () => req('/lease-agreements'),
  sendLeaseForSigning: (leaseId: string) => req(`/lease-agreements/for-lease/${leaseId}`, { method: 'POST' }),
  getLeaseTemplate: () => req('/lease-agreements/template'),
  setLeaseTemplate: (template: string) =>
    req('/lease-agreements/template', { method: 'PUT', body: JSON.stringify({ template }) }),
  uploadLeaseTemplateFile: (file: File): Promise<{ templateFileUrl: string }> =>
    reqForm('/lease-agreements/template-file', fileForm(file)),
  clearLeaseTemplateFile: () => req('/lease-agreements/template-file', { method: 'DELETE' }),

  // Smart lease parsing
  parseLeasePdf: (file: File) => reqForm('/lease-parsing', fileForm(file)),
  confirmExtraction: (id: string) => req(`/lease-parsing/${id}/confirm`, { method: 'POST' }),

  // Agents & commissions
  agents: () => req('/agents'),
  createAgent: (b: any) => req('/agents', { method: 'POST', body: JSON.stringify(b) }),
  updateAgent: (id: string, b: any) => req(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  setAgentStatus: (id: string, status: 'active' | 'inactive') => req(`/agents/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  agentStatement: (id: string) => req(`/agents/${id}/statement`),
  agentCommissions: (agentId?: string, status?: string) =>
    req(`/agents/commissions${agentId || status ? `?${agentId ? `agentId=${agentId}` : ''}${agentId && status ? '&' : ''}${status ? `status=${status}` : ''}` : ''}`),
  recordCommission: (b: any) => req('/agents/commissions', { method: 'POST', body: JSON.stringify(b) }),
  approveCommission: (id: string) => req(`/agents/commissions/${id}/approve`, { method: 'POST' }),
  payCommission: (id: string, reference?: string) => req(`/agents/commissions/${id}/pay`, { method: 'POST', body: JSON.stringify({ reference }) }),
  cancelCommission: (id: string) => req(`/agents/commissions/${id}/cancel`, { method: 'POST' }),

  brandingSettings: () => req('/settings/branding'),
  updateBranding: (body: any) => req('/settings/branding', { method: 'PUT', body: JSON.stringify(body) }),
};
