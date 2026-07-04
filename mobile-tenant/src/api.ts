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

async function req(path: string, opts: RequestInit = {}): Promise<any> {
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
  myInvoices: () => req('/me/invoices'),
  myLease: () => req('/me/lease'),
  initiatePayment: (invoiceId: string, method = 'eft') =>
    req(`/payments/invoices/${invoiceId}/initiate`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),
};
