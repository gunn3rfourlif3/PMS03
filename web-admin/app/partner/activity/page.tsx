'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, Presentation, StickyNote, ArrowRightLeft, UserPlus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, EmptyState } from '@/components/ui';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const ICON: Record<string, any> = { call: Phone, email: Mail, demo: Presentation, note: StickyNote, stage_change: ArrowRightLeft, signup: UserPlus };
const TYPES = ['call', 'email', 'demo', 'note'];

export default function ActivityPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('call');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try { setRows(await api.partnerActivities()); } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const log = async () => {
    if (!summary.trim()) return;
    setBusy(true); setErr('');
    try { await api.logPartnerActivity({ type, summary: summary.trim() }); setSummary(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Activity" subtitle="Your calls, demos, notes and pipeline moves" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36"><Field label="Type"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field></div>
          <div className="min-w-[220px] flex-1"><Field label="Summary"><input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Called Acme Rentals — sending a demo invite" /></Field></div>
          <Button onClick={log} loading={busy} disabled={!summary.trim()}>Log activity</Button>
        </div>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((a) => {
            const Icon = ICON[a.type] ?? StickyNote;
            return (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{a.summary || a.type}</div>
                  <div className="text-xs text-muted capitalize">{a.type.replace('_', ' ')}</div>
                </div>
                <span className="flex-none text-xs text-muted">{when(a.createdAt)}</span>
              </div>
            );
          })}
          {rows.length === 0 && <EmptyState>No activity yet.</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
