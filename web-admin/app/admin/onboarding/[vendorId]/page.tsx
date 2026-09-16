'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, Progress, EmptyState, ConfirmModal } from '@/components/ui';
import DomainEditor from '@/components/domain-editor';

type Item = {
  itemKey: string; stage: number; title: string; detail?: string | null;
  status: 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped' | 'failed';
  waitingOn: 'locare' | 'agency' | 'third_party';
  verifiable: boolean; weightHours: string | number; howToCheck?: string | null;
  completedAt?: string | null; notes?: string | null;
};
type Stage = {
  stage: number; name: string; purpose: string;
  state: 'complete' | 'current' | 'ahead';
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
  const [howTo, setHowTo] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = (await api.onboardingDetail(vendorId)) as Detail;
      setD(r);
      // Follow the work. The operator should see one thing to do, not fifty-two.
      //
      // This used to open the current stage only on the FIRST load, so finishing
      // a stage left it sitting open while the stage that now needed work stayed
      // shut — the console knew where you were and showed you where you had been.
      // Now a stage that has gone complete hands over to the current one, while a
      // stage someone deliberately opened and has not finished is left alone.
      setOpen((cur) => {
        if (cur === null) return r.stage;
        const openStage = r.stages.find((x) => x.stage === cur);
        return openStage && openStage.state === 'complete' && cur !== r.stage ? r.stage : cur;
      });
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

      {/* Stage 2's last manual step. It lives here rather than on the agencies
          page because this is where an operator is standing when they need it. */}
      <GlassCard className="mb-4">
        <DomainEditor vendorId={vendorId} />
      </GlassCard>

      <div className="space-y-3">
        {d.stages.map((s) => {
          const expanded = open === s.stage;
          const ahead = s.state === 'ahead';
          const isCurrent = s.stage === d.stage;
          const isComplete = s.state === 'complete';
          return (
            <GlassCard
              key={s.stage}
              style={isCurrent
                // An explicit shadow rather than Tailwind's ring utility, which
                // depends on a variable that is not guaranteed to be set here
                // and would silently draw nothing.
                ? { boxShadow: '0 0 0 2px var(--brand)' }
                // A finished stage recedes. It stays reachable — you may need to
                // reopen an item — but it stops competing for attention with the
                // one thing that actually needs doing.
                : isComplete ? { opacity: 0.72 } : undefined}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s.stage)}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold"
                  style={{
                    background: isComplete ? 'var(--success)'
                      : isCurrent ? 'var(--brand)' : 'color-mix(in srgb, var(--brand) 12%, transparent)',
                    color: isComplete || isCurrent ? 'var(--onbrand)' : 'var(--muted)',
                  }}>
                  {isComplete ? <Check size={15} /> : s.stage}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-heading text-base font-bold ${isCurrent || isComplete ? 'text-ink' : 'text-muted'}`}>
                      {s.name}
                    </span>
                    {isCurrent && <Badge tone="brand">You are here</Badge>}
                  </span>
                  {/* A finished stage does not need its purpose explained. */}
                  {!isComplete && <span className="block text-xs text-muted">{s.purpose}</span>}
                </span>
                <span className="flex-none text-xs text-muted">{s.done}/{s.total}</span>
                <span className="flex-none text-muted">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              </button>

              {/* Advice, not a gate. Onboardings stall on third parties constantly;
                  a console that refuses to let you do anything else while you wait
                  is one you stop opening. Say the order matters, then get out of
                  the way. */}
              {ahead && expanded && d.stage !== null && (
                <p className="mt-3 text-sm text-muted">
                  Stage {d.stage} isn&rsquo;t finished yet. The runbook&rsquo;s order exists for a reason —
                  migrating data before the hosts are live wastes the migration — but if you can
                  usefully get on with this now, do.
                </p>
              )}

              {expanded && (
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
                            {it.verifiable && (it.howToCheck ? (
                              // A disclosure, not a hover tooltip: these run to
                              // several lines, and a tooltip is unreadable on a
                              // phone and unreachable from a keyboard.
                              <button
                                type="button"
                                onClick={() => setHowTo((k) => (k === it.itemKey ? null : it.itemKey))}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-brand hover:underline"
                                aria-expanded={howTo === it.itemKey}
                              >
                                <HelpCircle size={12} />
                                {howTo === it.itemKey ? 'Hide' : 'How to check'}
                              </button>
                            ) : <span>· checkable</span>)}
                          </div>
                          {howTo === it.itemKey && it.howToCheck && (
                            <div
                              className="mt-2 rounded-xl border border-line px-3 py-2 text-sm text-ink"
                              style={{ background: 'color-mix(in srgb, var(--brand) 7%, transparent)' }}
                            >
                              {it.howToCheck}
                            </div>
                          )}
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
