'use client';

/**
 * God's-eye view — the whole portfolio on one screen, every unit's worst
 * condition visible at a glance.
 *
 * TWO LEVELS, NOT ONE. The roll-up (`rollup.tsx`) is the default and answers
 * "which property"; opening one hands its units to the grid, which answers
 * "which unit". One view trying to do both meant five hundred 44px tiles, and
 * at that size nothing can be counted, compared or read.
 *
 * Scope: ONE agency. `/reporting/portfolio-state` runs under RLS, so this is
 * the caller's own portfolio and there is no cross-agency variant by design —
 * a platform-wide roll-up would mean querying past tenant isolation.
 *
 * Deliberately keyless and offline-capable: no map tiles, no external hosts,
 * nothing to configure. That is what lets it work in the on-site demo's mode A,
 * where there is no internet at all. The 3D flythrough layers on top of this
 * later and degrades back to it.
 *
 * The view's state lives in the URL (see `view-state.ts`), so a filtered,
 * dated, unit-selected view is a link somebody can paste or bookmark.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Check, CircleAlert, Link2, RefreshCw, Wrench } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { BentoTile, Button, Donut, GlassCard, PageHeader } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import HaloGrid from '@/components/gods-eye/grid';
import Rollup from '@/components/gods-eye/rollup';
import UnitPanel from '@/components/gods-eye/unit-panel';
import { STATE_STYLE, type PortfolioState, type UnitState } from '@/components/gods-eye/state';
import {
  DEFAULT_VIEW_STATE,
  ViewState,
  decodeViewState,
  isDefaultViewState,
  viewStateUrl,
} from '@/components/gods-eye/view-state';

const PATH = '/gods-eye';

export default function GodsEyePage() {
  const router = useRouter();
  const { t, money, number } = useLocale();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<PortfolioState | null>(null);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * The URL is read once, from `window.location`, rather than through
   * `useSearchParams`: that hook opts the whole route into a client-side
   * bailout under the App Router, and this page is already a client component
   * reading its own address bar. One less thing to go wrong at build time.
   */
  useEffect(() => {
    if (!auth.get()) {
      router.replace('/login');
      return;
    }
    setView(decodeViewState(window.location.search));
    setReady(true);
  }, [router]);

  const load = useCallback(async (asOf?: string) => {
    setErr('');
    setLoading(true);
    try {
      setData(await api.portfolioState(asOf));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch only when the date changes; filtering and selecting are local.
  useEffect(() => {
    if (!ready) return;
    void load(view.asOf);
  }, [ready, view.asOf, load]);

  /**
   * Mirror the view into the address bar. `replaceState`, not `push`: a filter
   * click is not a navigation, and pushing would bury the page the operator
   * came from under a dozen history entries.
   */
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const url = viewStateUrl(PATH, view);
    if (url === lastUrl.current) return;
    lastUrl.current = url;
    window.history.replaceState(null, '', url);
  }, [ready, view]);

  const selected = useMemo(
    () => data?.units.find((u) => u.unitId === view.selected) ?? null,
    [data, view.selected],
  );

  const propertyUnits = useMemo(
    () => (view.property ? (data?.units.filter((u) => u.propertyId === view.property) ?? []) : []),
    [data, view.property],
  );

  /**
   * A link naming a property that is no longer in the payload falls back to the
   * roll-up rather than an empty grid — the same rule `view-state.ts` follows
   * for every other field: a stale link opens the portfolio, not an error.
   */
  const inProperty = view.property !== null && propertyUnits.length > 0;

  /** The legend counts belong to the property on screen, not the whole book. */
  const propertyByState = useMemo(() => {
    const out = Object.fromEntries(
      (Object.keys(STATE_STYLE) as UnitState[]).map((k) => [k, 0]),
    ) as Record<UnitState, number>;
    for (const u of propertyUnits) out[u.state] += 1;
    return out;
  }, [propertyUnits]);

  const copyLink = async () => {
    const url = `${window.location.origin}${viewStateUrl(PATH, view)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright (insecure origin, denied
      // permission). Say so rather than silently appearing to have worked.
      setErr('Could not copy — the link is in the address bar.');
    }
  };

  if (!ready) return null;

  const s = data?.summary;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('godsEye.title')}
        subtitle={t('godsEye.subtitle')}
        action={
          <div className="flex gap-2">
            <Button onClick={() => void copyLink()}>
              {copied ? <Check size={16} /> : <Link2 size={16} />}
              {copied ? 'Copied' : isDefaultViewState(view) ? 'Copy link' : 'Copy this view'}
            </Button>
            <Button onClick={() => void load(view.asOf)} disabled={loading}>
              <RefreshCw
                className={loading ? 'animate-spin motion-reduce:animate-none' : ''}
                size={16}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {err && (
        <GlassCard className="border-[var(--danger)] bg-[var(--dangerbg)] p-4 text-sm">{err}</GlassCard>
      )}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <BentoTile
            tone="blue"
            icon={<Building2 size={18} />}
            value={number(s.units)}
            label={`units across ${s.properties} ${s.properties === 1 ? 'property' : 'properties'}`}
          />
          <GlassCard className="flex items-center justify-center p-4">
            <Donut value={s.occupancyRate} sub="occupied" />
          </GlassCard>
          <BentoTile
            tone="coral"
            icon={<CircleAlert size={18} />}
            value={number(s.unitsInArrears)}
            label="units in arrears"
          />
          <BentoTile
            tone="amber"
            value={money(s.arrearsOutstanding)}
            label="outstanding on unpaid invoices"
          />
          <BentoTile
            tone="purple"
            icon={<Wrench size={18} />}
            value={number(s.openTickets)}
            label="open maintenance jobs"
          />
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <GlassCard className="min-w-0 flex-1 p-5">
          {!data ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              {loading ? 'Reading the portfolio…' : 'No data.'}
            </p>
          ) : (
            <>
              {inProperty ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setView((v) => ({ ...v, property: null, selected: null }))
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs transition hover:border-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                    >
                      <ArrowLeft aria-hidden size={14} />
                      {t('godsEye.backToPortfolio')}
                    </button>
                    <h2 className="text-base font-semibold">
                      {propertyUnits[0].propertyName}{' '}
                      <span className="font-normal text-[var(--muted)]">
                        ({propertyUnits.length})
                      </span>
                    </h2>
                  </div>
                  <HaloGrid
                    units={propertyUnits}
                    byState={propertyByState}
                    selectedId={view.selected}
                    onSelect={(u) => setView((v) => ({ ...v, selected: u.unitId }))}
                    filter={view.filter}
                    onFilter={(filter) => setView((v) => ({ ...v, filter, selected: null }))}
                    mode={view.mode}
                    onMode={(mode) => setView((v) => ({ ...v, mode }))}
                  />
                </>
              ) : (
                <Rollup
                  units={data.units}
                  money={money}
                  t={t}
                  onOpen={(propertyId) =>
                    setView((v) => ({ ...v, property: propertyId, selected: null }))
                  }
                />
              )}
              <p className="mt-4 text-[11px] text-[var(--muted)]">
                State as at {data.asOf}
                {view.asOf ? ' (fixed by this link)' : ''}. Every unit is judged against the same
                date.
              </p>
            </>
          )}
        </GlassCard>

        {data && selected && (
          <UnitPanel
            unit={selected}
            asOf={data.asOf}
            money={money}
            onClose={() => setView((v) => ({ ...v, selected: null }))}
          />
        )}
      </div>
    </div>
  );
}
