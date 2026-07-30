'use client';
import { useEffect, useRef, useState } from 'react';
import { auth, api } from '@/lib/api';
import { Modal, Button } from './ui';

/**
 * Idle auto-logout with a warning modal. After IDLE minutes of no interaction a
 * countdown warning appears; if it lapses the session is cleared and the browser
 * is sent to /login (a hard navigation, so no stale state survives). Genuine
 * activity slides a short-lived server session via a throttled /auth/refresh;
 * background polling alone won't keep it alive, so an idle session also expires
 * server-side. Per-tab timer (no cross-tab sharing) so the warning is reliable.
 *
 * Configure with NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES (default 10); keep in sync with
 * the API's SESSION_IDLE_MINUTES.
 */
const IDLE_MIN = Math.max(1, Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 10));
const IDLE_MS = IDLE_MIN * 60 * 1000;
const WARN_MS = Math.min(60_000, Math.floor(IDLE_MS / 3)); // warn up to 60s before
const REFRESH_EVERY = Math.floor(IDLE_MS / 2);
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export default function IdleTimeout() {
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const lastActive = useRef(Date.now());
  const lastRefresh = useRef(0);
  const warningRef = useRef(false);
  useEffect(() => { warningRef.current = warning; }, [warning]);

  const logout = () => {
    api.logout().catch(() => {});
    auth.clear();
    window.location.href = '/login';
  };

  const stay = () => {
    lastActive.current = Date.now();
    warningRef.current = false;
    setWarning(false);
    if (auth.get()) {
      lastRefresh.current = Date.now();
      api.refreshSession().then((r) => { if (r?.accessToken) auth.set(r.accessToken); }).catch(() => {});
    }
  };

  useEffect(() => {
    const mark = () => {
      if (warningRef.current) return;            // during the warning, only an explicit choice resets
      lastActive.current = Date.now();
      if (auth.get() && Date.now() - lastRefresh.current > REFRESH_EVERY) {
        lastRefresh.current = Date.now();
        api.refreshSession().then((r) => { if (r?.accessToken) auth.set(r.accessToken); }).catch(() => {});
      }
    };
    const tick = () => {
      if (!auth.get()) return;
      const elapsed = Date.now() - lastActive.current;
      if (elapsed >= IDLE_MS) { logout(); return; }
      if (elapsed >= IDLE_MS - WARN_MS) {
        warningRef.current = true;
        setWarning(true);
        setRemaining(Math.ceil((IDLE_MS - elapsed) / 1000));
      } else if (warningRef.current) {
        warningRef.current = false;
        setWarning(false);
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); EVENTS.forEach((e) => window.removeEventListener(e, mark)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal open={warning} onClose={stay} title="Still there?" size="sm"
      footer={<>
        <Button variant="ghost" onClick={logout}>Log out</Button>
        <Button onClick={stay}>Stay signed in</Button>
      </>}>
      <p className="text-sm text-muted">
        You've been inactive for a while. For your security you'll be signed out in{' '}
        <b className="text-ink">{remaining}s</b>.
      </p>
    </Modal>
  );
}
