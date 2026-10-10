'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, EmptyState, Donut, BENTO } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import { useBrand } from '@/components/brand-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

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

const WINDOWS = ['month', 'quarter', 'all'] as const satisfies readonly Win[];

/** Smaller rank number is better, so an improvement is prevRank > rank. */
function movement(t: TFunction, rank: number, prev: number | null) {
  if (prev == null) return { icon: '·', tone: 'text-muted', label: t('partner.leaderboard.move.new') };
  if (prev > rank) return { icon: '▲', tone: 'text-success', label: t('partner.leaderboard.move.up', { n: prev - rank }) };
  if (prev < rank) return { icon: '▼', tone: 'text-danger', label: t('partner.leaderboard.move.down', { n: rank - prev }) };
  return { icon: '–', tone: 'text-muted', label: t('partner.leaderboard.move.same') };
}

/* The medal label moved to the catalogue; the ordinal is a key per place rather
   than derived, since "1st/2nd/3rd" has no general rule across languages. */
const PODIUM = [
  { tone: 'amber' as const, medal: 'partner.leaderboard.medal.1' as MessageKey, h: 'h-[128px]' },
  { tone: 'blue' as const, medal: 'partner.leaderboard.medal.2' as MessageKey, h: 'h-[104px]' },
  { tone: 'coral' as const, medal: 'partner.leaderboard.medal.3' as MessageKey, h: 'h-[88px]' },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const { t, tn, money } = useLocale();
  // The gate copy named "Locare" literally; on a white-label deployment that is
  // the wrong name, so it comes from the brand like every other surface.
  const brand = useBrand();
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
        title={t('partner.leaderboard.title')}
        subtitle={t('partner.leaderboard.subtitle')}
        action={
          <div className="inline-flex rounded-full border border-line p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                  (win === w ? 'bg-brand text-white' : 'text-muted hover:text-ink')
                }
              >
                {t(`partner.leaderboard.window.${w}` as MessageKey)}
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
              {t('partner.leaderboard.yourRank', { total: rows.length, movement: movement(t, me.rank, me.prevRank).label })}
            </div>
          </div>
          <div className="rounded-3xl p-5" style={{ background: BENTO.teal.bg }}>
            <div className="font-heading text-3xl font-bold leading-none" style={{ color: BENTO.teal.text }}>
              {money(me.collected ?? 0)}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: BENTO.teal.sub }}>
              {t(`partner.leaderboard.collectedIn.${win}` as MessageKey)}
            </div>
          </div>
          <div className="rounded-3xl p-5" style={{ background: BENTO.green.bg }}>
            <div className="font-heading text-3xl font-bold leading-none" style={{ color: BENTO.green.text }}>
              {me.liveAgencies}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: BENTO.green.sub }}>
              {t('partner.leaderboard.liveAgenciesEarning', { active: me.activeMonths, of: RESELLER_GATE_MONTHS })}
            </div>
          </div>
        </div>
      )}

      {me && (
        <GlassCard className="mb-4">
          <div className="flex flex-wrap items-center gap-5">
            <Donut value={gatePct} tone="amber" sub={t('partner.leaderboard.ofGate')} />
            <div className="min-w-[240px] flex-1">
              <div className="font-heading text-base font-bold text-ink">{t('partner.leaderboard.gateHeading')}</div>
              <p className="mt-1 text-sm text-muted">
                {monthsMet >= RESELLER_GATE_MONTHS
                  ? t('partner.leaderboard.gateMet', {
                      amount: money(RESELLER_GATE_MONTHLY),
                      months: RESELLER_GATE_MONTHS,
                      brand: brand.name,
                    })
                  : `${t('partner.leaderboard.gateProgress', {
                      met: monthsMet,
                      months: RESELLER_GATE_MONTHS,
                      amount: money(RESELLER_GATE_MONTHLY),
                    })} ${shortfall > 0
                      ? t('partner.leaderboard.gateShortfall', { amount: money(shortfall) })
                      : t('partner.leaderboard.gateQualifies')}`}
              </p>
              <p className="mt-2 text-xs text-muted">
                {t('partner.leaderboard.rolling3m', { amount: money(me.collected3m ?? 0) })}
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
                  {t(PODIUM[i].medal)}
                </div>
                <div className="font-heading text-lg font-bold leading-tight" style={{ color: c.text }}>
                  {r.name}{r.isSelf ? ` ${t('partner.leaderboard.youSuffix')}` : ''}
                </div>
                <div className="mt-1 text-xs font-medium" style={{ color: c.sub }}>
                  {tn('partner.leaderboard.liveAgencies', r.liveAgencies)}
                  {r.activeMonths > 1 ? ` ${t('partner.leaderboard.earningMonths', { active: r.activeMonths, of: RESELLER_GATE_MONTHS })}` : ''}
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
                <th className="px-5 py-3 font-semibold">{t('partner.leaderboard.th.rank')}</th>
                <th className="px-5 py-3 font-semibold">{t('partner.leaderboard.th.partner')}</th>
                <th className="px-5 py-3 font-semibold">{t('partner.leaderboard.th.move')}</th>
                <th className="px-5 py-3 font-semibold">{t('partner.leaderboard.th.liveAgencies')}</th>
                <th className="px-5 py-3 font-semibold">{t('partner.leaderboard.th.earning')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('partner.leaderboard.th.collected')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = movement(t, r.rank, r.prevRank);
                return (
                  <tr
                    key={r.rank + r.name}
                    className={'border-t border-line ' + (r.isSelf ? 'bg-brand/[0.07]' : 'hover:bg-black/[0.02]')}
                  >
                    <td className="px-5 py-3 font-semibold text-ink">{r.rank}</td>
                    <td className="px-5 py-3 font-medium text-ink">
                      {r.name}
                      {r.isSelf && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">{t('partner.leaderboard.you')}</span>}
                    </td>
                    <td className={'px-5 py-3 text-xs font-semibold ' + m.tone} title={m.label}>{m.icon}</td>
                    <td className="px-5 py-3">{r.liveAgencies}</td>
                    <td className="px-5 py-3">{r.activeMonths > 0 ? t('partner.leaderboard.monthsOf', { active: r.activeMonths, of: RESELLER_GATE_MONTHS }) : t('common.none')}</td>
                    <td className="px-5 py-3 text-right">
                      {r.isSelf
                        ? <span className="font-semibold text-ink">{money(r.collected ?? 0)}</span>
                        : <span className="text-muted">{t('partner.leaderboard.private')}</span>}
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6}><EmptyState>{t('partner.leaderboard.empty')}</EmptyState></td></tr>
              )}
              {loading && rows.length === 0 && (
                <tr><td colSpan={6}><EmptyState>{t('partner.leaderboard.loading')}</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="mt-3 text-xs text-muted">
        {t('partner.leaderboard.privacyNote', { brand: brand.name })}
      </p>
    </div>
  );
}
