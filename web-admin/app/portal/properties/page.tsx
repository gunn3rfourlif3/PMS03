'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

/* The property `type` enum, keyed the same way /properties keys it — the two
   render the same values and must not drift. */
const PTYPES = ['building', 'complex', 'single_unit', 'co_living'] as const;
const typeLabel = (t: TFunction, v: string): string =>
  (PTYPES as readonly string[]).includes(v) ? t(`properties.type.${v}` as MessageKey) : v;

export default function PortalProperties() {
  const router = useRouter();
  const { t, money, percent } = useLocale();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    if (!isOwner()) { router.replace('/'); return; }
    setReady(true);
    api.portalProperties().then(setRows).catch((e) => setErr(e.message));
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title={t('portal.properties.title')} subtitle={t('portal.properties.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((p) => {
          const pct = p.units ? Math.round((p.occupied / p.units) * 100) : 0;
          return (
            <GlassCard key={p.id} hover>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                  <Building2 size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-heading font-bold text-ink">{p.name}</div>
                  <div className="text-sm text-muted">{typeLabel(t, p.type)}</div>
                </div>
                <Badge tone={pct === 100 ? 'success' : pct === 0 ? 'muted' : 'brand'}>{t('portal.properties.pctFull', { pct: percent(pct / 100, 0) })}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted">{t('portal.properties.unitsOccupied', { occupied: p.occupied, units: p.units })}</span>
                <span className="font-semibold text-ink">{money(p.monthlyRent)}<span className="text-muted">{t('portal.properties.perMonth')}</span></span>
              </div>
            </GlassCard>
          );
        })}
        {rows.length === 0 && <GlassCard><EmptyState>{t('portal.properties.empty')}</EmptyState></GlassCard>}
      </div>
    </div>
  );
}
