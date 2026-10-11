'use client';

/**
 * God's-eye view — the whole portfolio on one screen, every unit's worst
 * condition visible at a glance.
 *
 * Scope: ONE agency. `/reporting/portfolio-state` runs under RLS, so this is
 * the caller's own portfolio and there is no cross-agency variant by design —
 * a platform-wide roll-up would mean querying past tenant isolation.
 *
 * Deliberately keyless and offline-capable: no map tiles, no external hosts,
 * nothing to configure. That is what lets it work in the on-site demo's mode A,
 * where there is no internet at all. The 3D flythrough layers on top of this
 * later and degrades back to it.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CircleAlert, RefreshCw, Wrench } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { BentoTile, Button, Donut, GlassCard, PageHeader } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import HaloGrid from '@/components/gods-eye/grid';
import UnitPanel from '@/components/gods-eye/unit-panel';
import type { PortfolioState, PortfolioUnit, UnitState } from '@/components/gods-eye/state';

export default function GodsEyePage() {
  const router = useRouter();
  const { t, money, number } = useLocale();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<PortfolioState | null>(null);
  const [selected, setSelected] = useState<PortfolioUnit | null>(null);
  const [filter, setFilter] = useState<UnitState | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      setData(await api.portfolioState());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.get()) {
      router.replace('/login');
      return;
    }
    setReady(true);
    void load();
  }, [router, load]);

  if (!ready) return null;

  const s = data?.summary;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('godsEye.title')}
        subtitle={t('godsEye.subtitle')}
        action={
          <Button onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : ''} size={16} />
            Refresh
          </Button>
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
              <HaloGrid
                units={data.units}
                byState={data.summary.byState}
                selectedId={selected?.unitId ?? null}
                onSelect={setSelected}
                filter={filter}
                onFilter={(f) => {
                  setFilter(f);
                  setSelected(null);
                }}
              />
              <p className="mt-4 text-[11px] text-[var(--muted)]">
                State as at {data.asOf}. Every unit is judged against the same date.
              </p>
            </>
          )}
        </GlassCard>

        {data && selected && (
          <UnitPanel
            unit={selected}
            asOf={data.asOf}
            money={money}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
