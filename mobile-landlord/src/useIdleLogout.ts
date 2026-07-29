import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Idle auto-logout. Fires `onIdle` (sign out) after `timeoutMs` without user
 * interaction, or when the app returns to the foreground having been away longer
 * than that. While the user is interacting, `onRefresh` is called (throttled to
 * twice per window) to slide the server session forward. Returns a `mark` fn to
 * call on every touch (spread on a capturing wrapper View). Armed only while
 * `enabled` (the user is signed in).
 */
export function useIdleLogout(
  enabled: boolean,
  timeoutMs: number,
  onIdle: () => void,
  onRefresh?: () => void,
) {
  const last = useRef(Date.now());
  const lastRefresh = useRef(0);
  const cbIdle = useRef(onIdle); cbIdle.current = onIdle;
  const cbRefresh = useRef(onRefresh); cbRefresh.current = onRefresh;

  const mark = () => {
    last.current = Date.now();
    if (cbRefresh.current && Date.now() - lastRefresh.current > timeoutMs / 2) {
      lastRefresh.current = Date.now();
      cbRefresh.current();
    }
  };

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    const fire = () => { if (Date.now() - last.current > timeoutMs) cbIdle.current(); };
    const iv = setInterval(fire, 15000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') fire(); });
    return () => { clearInterval(iv); sub.remove(); };
  }, [enabled, timeoutMs]);

  return mark;
}
