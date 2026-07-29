'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, api } from '@/lib/api';

/**
 * Idle auto-logout. After IDLE minutes without interaction the token is cleared
 * and the user is sent to /login. While the user is active, the server session
 * is slid forward via a throttled /auth/refresh so the (short-lived) token never
 * expires mid-use — but background polling alone won't keep it alive, so an idle
 * session genuinely expires server-side too.
 *
 * Configure with NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES (default 10); keep it in sync
 * with the API's SESSION_IDLE_MINUTES. Last-active time is shared across tabs and
 * the interval also catches a sleeping/hidden tab.
 */
const IDLE_MIN = Math.max(1, Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 10));
const IDLE_MS = IDLE_MIN * 60 * 1000;
const REFRESH_EVERY = IDLE_MS / 2;
const KEY = 'pms_admin_last_active';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export default function IdleTimeout() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = 0;
    const mark = () => {
      try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
      // Slide the server session on real activity, throttled to twice per window.
      if (auth.get() && Date.now() - lastRefresh > REFRESH_EVERY) {
        lastRefresh = Date.now();
        api.refreshSession().then((r) => { if (r?.accessToken) auth.set(r.accessToken); }).catch(() => {});
      }
    };
    const check = () => {
      const last = Number(localStorage.getItem(KEY) || Date.now());
      if (Date.now() - last > IDLE_MS) {
        auth.clear();
        router.replace('/login');
      }
    };
    mark();
    EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const iv = setInterval(check, 15000);
    return () => {
      clearInterval(iv);
      EVENTS.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [router]);
  return null;
}
