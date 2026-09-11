'use client';
import { useCallback, useEffect, useState } from 'react';
import { Send, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, BentoTile, EmptyState, Modal, ConfirmModal } from '@/components/ui';

type Entry = {
  id: string; date: string; category: string; categoryLabel: string;
  title: string; body: string; action?: string;
  sentAt: string | null; sentTo: number | null;
};
type Payload = {
  entries: Entry[]; unsentCount: number; recipientCount: number;
  recipientsBySource: { partner: number; applicant: number; admin: number; extra: number };
};

const fmt = (s: string) => new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ChangelogPage() {
  const [d, setD] = useState<Payload | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = (await api.changelogList()) as Payload;
      setD(r);
      // Pre-tick everything unsent: the common case is "send what has piled up",
      // and making that the default costs one click instead of five.
      setPicked(r.entries.filter((e) => !e.sentAt).map((e) => e.id));
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const doPreview = async () => {
    setBusy('preview'); setErr('');
    try { setPreview(await api.changelogPreview(picked)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(''); }
  };

  const doSend = async () => {
    setBusy('send'); setErr(''); setOk('');
    try {
      const r = await api.changelogSend(picked);
      setOk(`Sent to ${r.recipients} recipient${r.recipients === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.`);
      setPreview(null);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(''); setConfirm(false); }
  };

  if (!d) {
    return (
      <div>
        <PageHeader title="Updates" />
        {err ? <div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div> : <EmptyState>Loading…</EmptyState>}
      </div>
    );
  }

  const by = d.recipientsBySource;
  const audience = [
    by.partner && `${by.partner} partner${by.partner === 1 ? '' : 's'}`,
    by.applicant && `${by.applicant} approved applicant${by.applicant === 1 ? '' : 's'}`,
    by.admin && `${by.admin} admin${by.admin === 1 ? '' : 's'}`,
    by.extra && `${by.extra} on the extra list`,
  ].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader title="Updates" subtitle="What changed, for the people who sell Locare" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {/* There is a `dangerbg` token but no `successbg` one, so this tints from
          the success colour directly rather than using a class that does not exist. */}
      {ok && (
        <div className="mb-4 rounded-xl px-3 py-2 text-sm text-success"
          style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>{ok}</div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BentoTile tone={d.unsentCount ? 'amber' : 'teal'} value={String(d.unsentCount)} label="Not sent yet" />
        <BentoTile tone="blue" value={String(d.recipientCount)} label="On the list" />
        <BentoTile tone="teal" value={String(picked.length)} label="Selected to send" />
      </div>

      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {d.recipientCount === 0
              ? 'Nobody is on the list yet — no active partners, and no extra addresses configured.'
              : <>Goes to <span className="font-medium text-ink">{audience}</span>. Read live, so a partner suspended today drops off.</>}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={doPreview} loading={busy === 'preview'} disabled={!picked.length}>
              <Eye size={15} /> Preview
            </Button>
            <Button onClick={() => setConfirm(true)} disabled={!picked.length || !d.recipientCount}>
              <Send size={15} /> Send {picked.length ? `${picked.length} update${picked.length === 1 ? '' : 's'}` : ''}
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {d.entries.map((e) => {
          const sent = !!e.sentAt;
          return (
            <GlassCard key={e.id} className={sent ? 'opacity-70' : undefined}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-none accent-[var(--brand)]"
                  checked={picked.includes(e.id)}
                  onChange={() => toggle(e.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={sent ? 'muted' : 'brand'}>{e.categoryLabel}</Badge>
                    <span className="text-xs text-muted">{fmt(e.date)}</span>
                    {sent && <Badge tone="success">Sent to {e.sentTo}</Badge>}
                  </span>
                  <span className="mt-1 block font-heading text-base font-bold text-ink">{e.title}</span>
                  <span className="mt-1 block text-sm text-muted">{e.body}</span>
                  {e.action && (
                    <span className="mt-2 block rounded-xl px-3 py-2 text-sm text-ink"
                      style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                      <span className="font-medium">What to do:</span> {e.action}
                    </span>
                  )}
                </span>
              </label>
            </GlassCard>
          );
        })}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Exactly what they'll receive" size="lg">
        <div className="mb-3 text-sm text-muted">Subject: <span className="text-ink">{preview?.subject}</span></div>
        <iframe
          title="Email preview"
          srcDoc={preview?.html ?? ''}
          className="h-[60vh] w-full rounded-xl border border-line bg-white"
        />
      </Modal>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doSend}
        loading={busy === 'send'}
        title="Send this update?"
        confirmLabel={`Send to ${d.recipientCount}`}
        message={
          <>
            <span className="block">
              {picked.length} update{picked.length === 1 ? '' : 's'} to {d.recipientCount} recipient{d.recipientCount === 1 ? '' : 's'}.
            </span>
            <span className="mt-2 block">
              Email cannot be recalled. If you have not previewed it, do that first.
            </span>
          </>
        }
      />
    </div>
  );
}
