'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Badge, Progress, EmptyState, BentoTile } from '@/components/ui';

type Row = {
  vendorId: string; name: string; slug: string; status: string;
  progress: { percent: number; remainingHours: number; itemsDone: number; itemsTotal: number };
  stage: number | null; stageName: string;
  waitingOn: 'locare' | 'agency' | 'third_party' | null;
  daysStalled: number; complete: boolean;
};

// "Waiting on us" is the only one that is your problem to solve today. The other
// two are chasing, and the difference is the whole point of the column.
const WAITING_LABEL: Record<string, string> = {
  locare: 'Us', agency: 'The agency', third_party: 'Someone else',
};
const waitingTone = (w: string | null): 'brand' | 'muted' | 'danger' | 'success' =>
  w === 'locare' ? 'brand' : w === null ? 'success' : 'muted';

/** A week without movement is a stall, not a pause. */
const stallTone = (d: number): 'danger' | 'brand' | 'muted' => (d >= 7 ? 'danger' : d >= 3 ? 'brand' : 'muted');

export default function OnboardingPortfolioPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.onboardingPortfolio()
      .then((r) => setRows(r as Row[]))
      .catch((e: any) => { setErr(e.message); setRows([]); });
  }, []);

  const live = (rows ?? []).filter((r) => !r.complete);
  const stalled = live.filter((r) => r.daysStalled >= 7).length;
  const onUs = live.filter((r) => r.waitingOn === 'locare').length;

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Every agency being brought live, longest stalled first" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BentoTile tone="blue" value={String(live.length)} label="In flight" />
        <BentoTile tone="teal" value={String(onUs)} label="Waiting on us" />
        <BentoTile tone={stalled ? 'amber' : 'teal'} value={String(stalled)} label="Stalled a week or more" />
      </div>

      <GlassCard>
        {rows === null ? (
          <EmptyState>Loading…</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>
            No agency has an onboarding checklist yet. Open an agency from Admin → Agencies and start one.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Agency</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3 w-56">Progress</th>
                  <th className="px-5 py-3">Left</th>
                  <th className="px-5 py-3">Waiting on</th>
                  <th className="px-5 py-3">Not moving</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vendorId} className="border-t border-line">
                    <td className="px-5 py-3">
                      <Link href={`/admin/onboarding/${r.vendorId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted">{r.slug}</div>
                    </td>
                    <td className="px-5 py-3">
                      {r.complete
                        ? <Badge tone="success">Complete</Badge>
                        : <span className="text-ink">{r.stage} · {r.stageName}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Progress value={r.progress.percent} />
                      <div className="mt-1 text-xs text-muted">
                        {r.progress.percent}% · {r.progress.itemsDone} of {r.progress.itemsTotal} items
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      {r.complete ? '—' : `~${r.progress.remainingHours}h`}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={waitingTone(r.waitingOn)}>
                        {r.waitingOn ? WAITING_LABEL[r.waitingOn] : 'Nobody'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.complete ? <span className="text-muted">—</span> : (
                        <Badge tone={stallTone(r.daysStalled)}>
                          {r.daysStalled === 0 ? 'Today' : `${r.daysStalled}d`}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
