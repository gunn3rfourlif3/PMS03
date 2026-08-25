'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, EmptyState, Donut, money, BENTO } from '@/components/ui';

type Win = 'month' | 'quarter' | 'all';

interface Row {
  rank: number;
  name: string;
  partnerId: string | null;
  isSelf: boolean;
  prevRank: number | null;
  liveAgencies: number;
  activeMonths: number;   // months with revenue, of the last 3
  collected: number | null;      // caller's own row only
  collected3m: number | null;    // caller's own row only
  qualifyingMonths: number | null;
}

const RESELLER_GATE_MONTHLY = 15000;
const RESELLER_GATE_MONTHS = 3;

const WINDOWS: { key: Win; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'all', label: 'All time' },
];

/** Smaller rank number is better, so an improvement is prevRank > rank. */
function movement(rank: number, prev: number | null) {
  if (prev == null) return { icon: '·', tone: 'text-muted', label: 'new' };
  if (prev > rank) return { icon: '▲', tone: 'text-success', label: `up ${prev - rank}` };
  if (prev < rank) return { icon: '▼', tone: 'text-danger', label: `down ${rank - prev}` };
  return { icon: '–', tone: 'text-muted', label: 'no change' };
}

const PODIUM = [
  { tone: 'amber' as const, medal: '1st', h: 'h-[128px]' },
  { tone: 'blue' as const, medal: '2nd', h: 'h-[104px]' },
  { tone: 'coral' as const, medal: '3rd', h: 'h-[88px]' },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [win, setWin] = useState<Win>('month');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    api.partnerLeaderboard(win)
      .then((d: Row[]) => { if (!cancelled) { setRows(d ?? []); setErr(''); } })
      .catch((e: any) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, win]);

  if (!ready) return null;

  const me = rows.find((r) => r.isSelf) ?? null;
  const top3 = rows.slice(0, 3);

  // Everyone starts on zero collected, so an all-zero board is ranked
  // alphabetically and a podium would imply an achievement nobody has.
  const boardHasRevenue = rows.some((r) => (r.collected ?? 0) > 0) || (me?.collected ?? 0) > 0;

  const monthsMet = Math.max(0, Math.min(RESELLER_GATE_MONTHS, me?.qualifyingMonths ?? 0));
  const gatePct = (monthsMet / RESELLER_GATE_MONTHS) * 100;
  const shortfall = Math.max(0, RESELLER_GATE_MONTHLY - (me?.collected ?? 0));

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Ranked on rent-roll subscription revenue actually collected — not signed, not invoiced"
        action={
          <div className="inline-flex rounded-full border border-line p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => setWin(w.key)}
                className={
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                  (win === w.key ? 'bg-brand text-white' : 'text-muted hover:text-ink')
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      />

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {me && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl p-5" style={{ background: BENTO.purple.bg }}>
            <div className="font-heading text-3xl font-bold leading-none" style={{ color: BENTO.purple.text }}>
              #{me.rank}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: BENTO.purple.sub }}>
              Your rank of {rows.length} · {movement(me.rank, me.prevRank).label}
            </div>
          </div>
          <div className="rounded-3xl p-5" style={{ background: BENTO.teal.bg }}>
            <div className="font-heading text-3xl font-bold leading-none" style={{ color: BENTO.teal.text }}>
              {money(me.collected ?? 0)}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: BENTO.teal.sub }}>
              Collected {win === 'all' ? 'all time' : win === 'quarter' ? 'this quarter' : 'this month'}
            </div>
          </div>
          <div className="rounded-3xl p-5" style={{ background: BENTO.green.bg }}>
            <div className="font-heading text-3xl font-bold leading-none" style={{ color: BENTO.green.text }}>
              {me.liveAgencies}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: BENTO.green.sub }}>
              Live paying agencies · earning in {me.activeMonths} of last 3 months
            </div>
          </div>
        </div>
      )}

      {me && (
        <GlassCard className="mb-4">
          <div className="flex flex-wrap items-center gap-5">
            <Donut value={gatePct} tone="amber" sub="of gate" />
            <div className="min-w-[240px] flex-1">
              <div className="font-heading text-base font-bold text-ink">Progress to Reseller (26%)</div>
              <p className="mt-1 text-sm text-muted">
                {monthsMet >= RESELLER_GATE_MONTHS ? (
                  <>
                    You have met {money(RESELLER_GATE_MONTHLY)} collected for {RESELLER_GATE_MONTHS} consecutive
                    months. Promotion is an admin review, not automatic — Locare will be in touch.
                  </>
                ) : (
                  <>
                    {monthsMet} of {RESELLER_GATE_MONTHS} months at {money(RESELLER_GATE_MONTHLY)} collected.
                    {shortfall > 0
                      ? <> A further <strong className="text-ink">{money(shortfall)}</strong> collected this month puts the current month over the line.</>
                      : <> This month already qualifies.</>}
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-muted">
                Rolling three months: {money(me.collected3m ?? 0)} collected.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {boardHasRevenue && top3.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {top3.map((r, i) => {
            const c = BENTO[PODIUM[i].tone];
            return (
              <div
                key={r.rank + r.name}
                className={'flex flex-col justify-end rounded-3xl p-5 ' + PODIUM[i].h}
                style={{ background: c.bg, outline: r.isSelf ? `2px solid ${c.bar}` : undefined }}
              >
                <div className="mb-auto text-xs font-semibold uppercase tracking-wide" style={{ color: c.sub }}>
                  {PODIUM[i].medal}
                </div>
                <div className="font-heading text-lg font-bold leading-tight" style={{ color: c.text }}>
                  {r.name}{r.isSelf ? ' · you' : ''}
                </div>
                <div className="mt-1 text-xs font-medium" style={{ color: c.sub }}>
                  {r.liveAgencies} live {r.liveAgencies === 1 ? 'agency' : 'agencies'}
                  {r.activeMonths > 1 ? ` · earning ${r.activeMonths}/3 months` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-5 py-3 font-semibold">Partner</th>
                <th className="px-5 py-3 font-semibold">Move</th>
                <th className="px-5 py-3 font-semibold">Live agencies</th>
                <th className="px-5 py-3 font-semibold">Earning</th>
                <th className="px-5 py-3 text-right font-semibold">Collected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = movement(r.rank, r.prevRank);
                return (
                  <tr
                    key={r.rank + r.name}
                    className={'border-t border-line ' + (r.isSelf ? 'bg-brand/[0.07]' : 'hover:bg-black/[0.02]')}
                  >
                    <td className="px-5 py-3 font-semibold text-ink">{r.rank}</td>
                    <td className="px-5 py-3 font-medium text-ink">
                      {r.name}
                      {r.isSelf && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">you</span>}
                    </td>
                    <td className={'px-5 py-3 text-xs font-semibold ' + m.tone} title={m.label}>{m.icon}</td>
                    <td className="px-5 py-3">{r.liveAgencies}</td>
                    <td className="px-5 py-3">{r.activeMonths > 0 ? `${r.activeMonths}/3 mo` : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {r.isSelf
                        ? <span className="font-semibold text-ink">{money(r.collected ?? 0)}</span>
                        : <span className="text-muted">private</span>}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6}><EmptyState>No active partners on the board yet.</EmptyState></td></tr>
              )}
              {loading && rows.length === 0 && (
                <tr><td colSpan={6}><EmptyState>Loading…</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="mt-3 text-xs text-muted">
        Other partners&rsquo; revenue is private — you see their rank, agency count and activity only, and they see
        the same of yours. Ranking is on subscription fees Locare has actually received, so the board matches
        your commission statement.
      </p>
    </div>
  );
}
