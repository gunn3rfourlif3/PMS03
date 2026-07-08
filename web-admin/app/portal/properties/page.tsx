'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Badge, EmptyState, money } from '@/components/ui';

const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function PortalProperties() {
  const router = useRouter();
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
      <PageHeader title="Properties" subtitle="The properties we manage for you" />
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
                  <div className="text-sm text-muted">{humanize(p.type)}</div>
                </div>
                <Badge tone={pct === 100 ? 'success' : pct === 0 ? 'muted' : 'brand'}>{pct}% full</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3 text-sm">
                <span className="text-muted">{p.occupied}/{p.units} units occupied</span>
                <span className="font-semibold text-ink">{money(p.monthlyRent)}<span className="text-muted">/mo</span></span>
              </div>
            </GlassCard>
          );
        })}
        {rows.length === 0 && <GlassCard><EmptyState>No properties on file.</EmptyState></GlassCard>}
      </div>
    </div>
  );
}
