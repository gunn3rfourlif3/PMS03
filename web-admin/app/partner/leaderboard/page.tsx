'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, EmptyState, money } from '@/components/ui';

export default function LeaderboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    (async () => {
      try {
        const [board, me] = await Promise.all([api.partnerLeaderboard(), api.partnerMe().catch(() => null)]);
        setRows(board); setMeId(me?.id ?? null);
      } catch (e: any) { setErr(e.message); }
    })();
    // eslint-disable-next-line
  }, []);

  if (!ready) return null;
  const top = rows.slice(0, 8).map((r) => ({ name: r.name, mrr: Number(r.referredMrr) || 0 }));

  return (
    <div>
      <PageHeader title="Leaderboard" subtitle="Global ranking across all partners — by referred MRR" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {top.length > 0 && (
        <GlassCard className="mb-4">
          <div className="mb-2 font-heading text-base font-bold text-ink">Top partners by referred MRR</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => 'R' + (v / 1000) + 'k'} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: 'var(--ink)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="mrr" radius={[0, 8, 8, 0]} barSize={20}>
                  {top.map((_, i) => <Cell key={i} fill={['#534AB7', '#1D9E75', '#378ADD', '#EF9F27', '#D4537E', '#D85A30', '#639922', '#0F6E56'][i % 8]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">#</th><th className="px-5 py-3 font-semibold">Partner</th><th className="px-5 py-3 font-semibold">Agencies</th><th className="px-5 py-3 font-semibold">Referred MRR</th><th className="px-5 py-3 font-semibold">Deals won</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.partnerId} className={'border-t border-line ' + (r.partnerId === meId ? 'bg-brand/[0.06]' : 'hover:bg-black/[0.02]')}>
                  <td className="px-5 py-3 font-semibold text-ink">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-ink">{r.name}{r.partnerId === meId ? ' · you' : ''}</td>
                  <td className="px-5 py-3">{r.agenciesSigned}</td>
                  <td className="px-5 py-3">{money(r.referredMrr)}</td>
                  <td className="px-5 py-3">{r.dealsWon}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5}><EmptyState>No partners on the board yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
