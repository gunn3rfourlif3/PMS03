'use client';
/**
 * Signal wiring — LOCARE_ASSISTANT_DESIGN.md §6.
 *
 * The pure functions live in `signals.ts`. This file is the only place that
 * feeds them, and it does so from the same partner endpoints the pages already
 * call (`/partner/deals`, `/partner/banking`, `/partner/me`) with the signed-in
 * user's own JWT — no new endpoint, no new query shape, no read as another role.
 *
 * It fetches once, lazily, when the panel is first opened: a closed panel costs
 * nothing, and nothing here re-fetches on navigation. On any failure the hook
 * returns an empty list, so the panel silently falls back to its curated
 * content rather than showing an error the partner cannot act on.
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  type Signal,
  bankingSignal,
  openLeadCapSignal,
  staleDealsSignal,
  unreadChangelogSignal,
} from './signals';

/** At most this many prompts render at once (design §6: the panel is not a queue). */
export const MAX_SIGNALS = 3;

/**
 * Where partners read product updates. Empty on purpose: the changelog is
 * served at `/admin/changelog`, which is not a partner route, so the unread
 * signal has nowhere to land and `unreadChangelogSignal` returns null for a
 * blank href. Fill this in when a partner-side changelog route exists.
 */
export const PARTNER_CHANGELOG_HREF = '';

/**
 * Signals whose resolution is gated on the partner being approved.
 *
 * THE BLOCKED-UPSTREAM GUARD (design §6). Partner approval is currently held up
 * by the outstanding VAT number, so no payout can run for a partner who is not
 * yet `active` however complete their banking is. Telling them to go fix their
 * banking "so payouts can run" is a prompt about something blocked upstream:
 * they do the work, nothing happens, and they learn to ignore the panel. These
 * ids therefore fire only for an `active` partner — and, because an unknown or
 * unreadable status is not evidence of approval, they stay silent then too.
 *
 * This is a guard, not a filter on content: when the VAT number lands and
 * approvals resume, partners move to `active` and these fire on their own.
 */
export const APPROVAL_GATED_SIGNAL_IDS: readonly string[] = ['banking-missing'];

/** Only an explicitly `active` partner is past the approval gate. */
export function isPastApprovalGate(status: unknown): boolean {
  return status === 'active';
}

type SignalInputs = {
  deals: unknown[];
  banking: Record<string, unknown> | null;
  status: unknown;
  openDeals: number;
  openLeadCap: number;
};

/** The cap is the partner's own, as `/partner/me` reports it; absent means no cap signal. */
function capFrom(me: Record<string, unknown> | null): number {
  const raw = me?.openLeadCap ?? me?.maxOpenLeads ?? me?.leadCap;
  return Number(raw);
}

export function buildSignals(input: SignalInputs, now: number = Date.now()): Signal[] {
  const all = [
    staleDealsSignal(input.deals as never[], now),
    openLeadCapSignal(input.openDeals, input.openLeadCap),
    bankingSignal(input.banking),
    unreadChangelogSignal(0, PARTNER_CHANGELOG_HREF),
  ].filter((s): s is Signal => s !== null);

  const past = isPastApprovalGate(input.status);
  return all
    .filter((s) => past || !APPROVAL_GATED_SIGNAL_IDS.includes(s.id))
    .slice(0, MAX_SIGNALS);
}

/**
 * Fetches once when `enabled` first turns true and returns the prompts to render.
 * An empty array means "render nothing" — never a spinner, never "no issues".
 */
export function useAssistantSignals(enabled: boolean): Signal[] {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    setLoaded(true);
    (async () => {
      try {
        const [deals, banking, me] = await Promise.all([
          api.partnerDeals().catch(() => []),
          api.partnerBanking().catch(() => null),
          api.partnerMe().catch(() => null),
        ]);
        if (cancelled) return;
        const list: any[] = Array.isArray(deals) ? deals : [];
        const cap = capFrom(me);
        const openDeals = list.filter((d) => d && d.stage !== 'won' && d.stage !== 'lost').length;
        setSignals(buildSignals({
          deals: list,
          banking: banking ?? null,
          status: me?.status,
          openDeals,
          openLeadCap: cap,
        }));
      } catch {
        if (!cancelled) setSignals([]);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, loaded]);

  return signals;
}
