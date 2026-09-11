'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, Progress, EmptyState, ConfirmModal } from '@/components/ui';

type Item = {
  itemKey: string; stage: number; title: string; detail?: string | null;
  status: 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped' | 'failed';
  waitingOn: 'locare' | 'agency' | 'third_party';
  verifiable: boolean; weightHours: string | number;
  completedAt?: string | null; notes?: string | null;
};
type Stage = {
  stage: number; name: string; purpose: string;
  state: 'complete' | 'current' | 'locked';
  done: number; total: number; remainingHours: number; items: Item[];
};
type Detail = {
  vendor: { vendorId: string; name: string; slug: string; status: string; customDomain?: string | null };
  templateVersion: string; seeded: boolean;
  progress: { percent: number; remainingHours: number; itemsDone: number; itemsTotal: number; itemsFailed: number };
  stage: number | null; stageName: string;
  waitingOn: 'locare' | 'agency' | 'third_party' | null;
  daysStalled: number; stages: Stage[];
};

const WAITING_LABEL: Record<string, string> = {
  locare: 'us', agency: 'the agency', third_party: 'someone else',
};
const STATUS_LABEL: Record<Item['status'], string> = {
  pending: 'Not started', in_progress: 'In progress', blocked: 'Blocked',
  done: 'Done', skipped: 'Not applicable', failed: 'Failed',
};
const statusTone = (s: Item['status']): 'success' | 'brand' | 'danger' | 'muted' =>
  s === 'done' ? 'success' : s === 'failed' || s === 'blocked' ? 'danger' : s === 'in_progress' ? 'brand' : 'muted';

export default function OnboardingDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = (await api.onboardingDetail(vendorId)) as Detail;
      setD(r);
      // Open the stage that needs work. The operator should see one thing to do,
      // not fifty-two — everything else stays collapsed until it is their turn.
      setOpen((cur) => (cur === null ? r.stage : cur));
    } catch (e: any) { setErr(e.message); }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (item: Item, body: { status?: string; waitingOn?: string }) => {
    setBusy(item.itemKey); setErr('');
    try { await api.onboardingUpdateItem(vendorId, item.itemKey, body); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(''); setConfirm(null); }
  };

  const seed = async () => {
    setBusy('seed'); setErr('');
    try { await api.onboardingSeed(vendorId); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(''); }
  };

  if (!d) {
    return (
      <div>
        <PageHeader title="Onboarding" />
        {err ? <div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div> : <EmptyState>Loading…</EmptyState>}
      </div>
    );
  }

  if (!d.seeded) {
    return (
      <div>
        <PageHeader title={d.vendor.name} subtitle="Onboarding" />
        <GlassCard>
          <p className="text-sm text-muted">
            This agency has no onboarding checklist yet. Starting one creates the nine stages from
            the current runbook and changes nothing about the agency itself.
          </p>
          <div className="mt-4"><Button onClick={seed} loading={busy === 'seed'}>Start onboarding</Button></div>
        </GlassCard>
      </div>
    );
  }

  const complete = d.stage === null;

  return (
    <div>
      <PageHeader
        title={d.vendor.name}
        subtitle={`Onboarding · ${d.vendor.slug}`}
        action={<Link href="/admin/onboarding" className="text-sm text-muted underline-offset-2 hover:underline">All onboardings</Link>}
      />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-heading text-lg font-bold text-ink">
            {complete ? 'Onboarding complete' : `Stage ${d.stage} of 9 — ${d.stageName}`}
          </div>
          <div className="text-sm text-muted">
            {complete ? `${d.progress.itemsTotal} items` : `about ${d.progress.remainingHours} hours of work left`}
          </div>
        </div>
        <div className="mt-3"><Progress value={d.progress.percent} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>{d.progress.percent}% · {d.progress.itemsDone} of {d.progress.itemsTotal} items</span>
          {!complete && d.waitingOn && <Badge tone={d.waitingOn === 'locare' ? 'brand' : 'muted'}>Waiting on {WAITING_LABEL[d.waitingOn]}</Badge>}
          {d.progress.itemsFailed > 0 && (
            <Badge tone="danger">{d.progress.itemsFailed} check{d.progress.itemsFailed === 1 ? '' : 's'} failing</Badge>
          )}
          {!complete && d.daysStalled >= 3 && <Badge tone={d.daysStalled >= 7 ? 'danger' : 'brand'}>Nothing has moved in {d.daysStalled} days</Badge>}
          <span className="ml-auto">{d.templateVersion}</span>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {d.stages.map((s) => {
          const expanded = open === s.stage;
          const locked = s.state === 'locked';
          return (
            <GlassCard key={s.stage} className={locked ? 'opacity-60' : undefined}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s.stage)}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold"
                  style={{
                    background: s.state === 'complete' ? 'var(--brand)' : 'color-mix(in srgb, var(--brand) 12%, transparent)',
                    color: s.state === 'complete' ? 'var(--onbrand)' : 'var(--ink)',
                  }}>
                  {s.state === 'complete' ? <Check size={15} /> : locked ? <Lock size={13} /> : s.stage}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-bold text-ink">{s.name}</span>
                  <span className="block text-xs text-muted">{s.purpose}</span>
                </span>
                <span className="flex-none text-xs text-muted">{s.done}/{s.total}</span>
                <span className="flex-none text-muted">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              </button>

              {locked && expanded && (
                <p className="mt-3 text-sm text-muted">
                  This stage opens when stage {d.stage} is finished. You can still work out of order —
                  mark anything that does not apply as “Not applicable” and it stops holding the gate.
                </p>
              )}

              {expanded && !locked && (
                <ul className="mt-3 space-y-2">
                  {s.items.map((it) => (
                    <li key={it.itemKey} className="rounded-2xl border border-line px-4 py-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-ink">{it.title}</div>
                          {it.detail && <div className="mt-0.5 text-xs text-muted">{it.detail}</div>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <Badge tone={statusTone(it.status)}>{STATUS_LABEL[it.status]}</Badge>
                            <span>waiting on {WAITING_LABEL[it.waitingOn]}</span>
                            <span>· ~{Number(it.weightHours)}h</span>
                            {it.verifiable && <span title="An automated check will confirm this once checks ship">· checkable</span>}
                          </div>
                        </div>
                        <div className="flex flex-none gap-2">
                          {it.status !== 'done' && (
                            <>
                              {it.status !== 'in_progress' && (
                                <Button variant="ghost" onClick={() => patch(it, { status: 'in_progress' })} loading={busy === it.itemKey}>Start</Button>
                              )}
                              <Button onClick={() => setConfirm(it)} loading={busy === it.itemKey}>Mark done</Button>
                            </>
                          )}
                          {it.status === 'done' && (
                            <Button variant="ghost" onClick={() => patch(it, { status: 'pending' })} loading={busy === it.itemKey}>Reopen</Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          );
        })}
      </div>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && patch(confirm, { status: 'done' })}
        title="Mark this done?"
        confirmLabel="Yes, it's done"
        loading={!!busy && busy === confirm?.itemKey}
        message={
          <>
            <span className="block font-medium text-ink">{confirm?.title}</span>
            <span className="mt-2 block">
              Your name and the time are recorded against it, so whoever picks this
              onboarding up next can see who signed it off.
            </span>
          </>
        }
      />
    </div>
  );
}
