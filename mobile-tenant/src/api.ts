import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';

const KEY = 'pms_token';
const isWeb = Platform.OS === 'web';

const store = {
  get: (): Promise<string | null> =>
    isWeb ? Promise.resolve(globalThis.localStorage?.getItem(KEY) ?? null) : SecureStore.getItemAsync(KEY),
  set: (v: string): Promise<void> =>
    isWeb ? Promise.resolve(globalThis.localStorage?.setItem(KEY, v)) : SecureStore.setItemAsync(KEY, v),
  del: (): Promise<void> =>
    isWeb ? Promise.resolve(globalThis.localStorage?.removeItem(KEY)) : SecureStore.deleteItemAsync(KEY),
};

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await store.get();
  return token;
}
export async function setToken(t: string): Promise<void> {
  token = t;
  await store.set(t);
}
export async function clearToken(): Promise<void> {
  token = null;
  await store.del();
}

/** App registers this to drop to the login screen when a session is rejected. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

async function req(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 && token) { await clearToken(); onUnauthorized?.(); throw new Error('Your session has expired. Please sign in again.'); }
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
  profile: () => req('/me/profile'),
  myInvoices: () => req('/me/invoices'),
  myLease: () => req('/me/lease'),
  myLeaseAgreement: () => req('/lease-agreements/mine'),
  initiatePayment: (invoiceId: string, method = 'eft') =>
    req(`/payments/invoices/${invoiceId}/initiate`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),

  // Proof of payment (manual EFT) — multipart upload.
  uploadProof: async (
    invoiceId: string,
    asset: { uri: string; name?: string; mimeType?: string; file?: any },
    extra?: { reference?: string; amount?: string },
  ): Promise<any> => {
    const form = new FormData();
    if (asset.file || Platform.OS === 'web') {
      const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
      form.append('file', blob, asset.name || 'proof.jpg');
    } else {
      form.append('file', { uri: asset.uri, name: asset.name || 'proof.jpg', type: asset.mimeType || 'image/jpeg' } as any);
    }
    form.append('invoiceId', invoiceId);
    if (extra?.reference) form.append('reference', extra.reference);
    if (extra?.amount) form.append('amount', extra.amount);
    const res = await fetch(`${API_BASE}/proof-of-payment`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form as any,
    });
    if (res.status === 401 && token) { await clearToken(); onUnauthorized?.(); throw new Error('Your session has expired. Please sign in again.'); }
    if (!res.ok) {
      const b = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((Array.isArray(b.message) ? b.message.join(', ') : b.message) || `Upload failed (${res.status})`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  // Maintenance (tenant self-service)
  myTickets: () => req('/maintenance/tickets/mine'),
  createTicket: (b: { unitId: string; category: string; description: string; priority?: string }) =>
    req('/maintenance/tickets', { method: 'POST', body: JSON.stringify(b) }),
  approveTicket: (id: string) => req(`/maintenance/tickets/${id}/approve`, { method: 'POST' }),

  // Messaging
  refreshSession: (): Promise<{ accessToken: string; idleMinutes: number }> => req('/auth/refresh', { method: 'POST' }),
  messageUnread: () => req('/messages/unread-count'),
  myMessages: () => req('/messages/mine'),
  messageThread: (id: string) => req(`/messages/conversations/${id}`),
  startConversation: (subject: string, body: string) =>
    req('/messages/conversations', { method: 'POST', body: JSON.stringify({ subject, body }) }),
  messageReply: (id: string, body: string) =>
    req(`/messages/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
};
