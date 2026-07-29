import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';

const KEY = 'pms_landlord_token';
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
export async function loadToken() { token = await store.get(); return token; }
export async function setToken(t: string) { token = t; await store.set(t); }
export async function clearToken() { token = null; await store.del(); }

async function req(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(Array.isArray(b.message) ? b.message.join(', ') : b.message || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  requestOtp: (destination: string) => req('/auth/otp/request', { method: 'POST', body: JSON.stringify({ destination }) }),
  verifyOtp: (destination: string, code: string) => req('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ destination, code }) }),
  profile: () => req('/me/profile'),
  rentRoll: () => req('/reporting/rent-roll'),
  arrears: () => req('/reporting/arrears'),
  collection: (period: string) => req(`/reporting/collection/${period}`),
  applications: () => req('/listings/applications'),
  screen: (id: string) => req(`/listings/applications/${id}/screen`, { method: 'POST', body: JSON.stringify({ monthlyIncome: 30000, creditScore: 710 }) }),
  approve: (id: string, startDate: string) => req(`/listings/applications/${id}/approve`, { method: 'POST', body: JSON.stringify({ startDate }) }),
  reject: (id: string) => req(`/listings/applications/${id}/reject`, { method: 'POST' }),

  // Maintenance / ticketing
  tickets: () => req('/maintenance/tickets'),
  workOrders: () => req('/maintenance/work-orders'),
  assignTicket: (id: string, contractorId?: string) => req(`/maintenance/tickets/${id}/work-order`, { method: 'POST', body: JSON.stringify({ contractorId }) }),
  providers: () => req('/service-providers'),
  startWorkOrder: (id: string) => req(`/maintenance/work-orders/${id}/progress`, { method: 'POST' }),
  completeWorkOrder: (id: string, cost: number) => req(`/maintenance/work-orders/${id}/complete`, { method: 'POST', body: JSON.stringify({ cost }) }),

  // Messaging (staff)
  messageUnread: () => req('/messages/unread-count'),
  messageInbox: () => req('/messages/inbox'),
  messageThread: (id: string) => req(`/messages/conversations/${id}`),
  messageReply: (id: string, body: string) => req(`/messages/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  messageSetStatus: (id: string, status: 'open' | 'closed') => req(`/messages/conversations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};
