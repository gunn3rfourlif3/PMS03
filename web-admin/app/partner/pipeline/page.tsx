'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { PageHeader, Button, Field, Modal, EmptyState, money } from '@/components/ui';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: '#B5D4F4' },
  { key: 'contacted', label: 'Contacted', color: '#CECBF6' },
  { key: 'demo', label: 'Demo', color: '#FAC775' },
  { key: 'trial', label: 'Trial', color: '#9FE1CB' },
  { key: 'proposal', label: 'Proposal', color: '#F4C0D1' },
  { key: 'won', label: 'Won', color: '#C0DD97' },
  { key: 'lost', label: 'Lost', color: '#F5C4B3' },
];

const blank = () => ({ prospectName: '', contactName: '', contactEmail: '', contactPhone: '', expectedUnits: '', expectedMrr: '' });

export default function PipelinePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [deals, setDeals] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blank());

  const load = useCallback(async () => {
    setErr('');
    try { setDeals(await api.partnerDeals()); } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const move = async (id: string, stage: string) => {
    let lostReason: string | undefined;
    if (stage === 'lost') lostReason = window.prompt('Reason lost? (optional)') || undefined;
    try { await api.moveDealStage(id, stage, lostReason); await load(); } catch (e: any) { setErr(e.message); }
  };

  const add = async () => {
    if (!form.prospectName.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.createDeal({ ...form, expectedUnits: Number(form.expectedUnits) || 0, expectedMrr: Number(form.expectedMrr) || 0 });
      setShowAdd(false); setForm(blank()); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const byStage = (s: string) => deals.filter((d) => d.stage === s);
  const colValue = (s: string) => byStage(s).reduce((sum, d) => sum + Number(d.expectedMrr || 0), 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Pipeline" subtitle="Track prospective agencies through the sales funnel" />
        <Button onClick={() => { setForm(blank()); setShowAdd(true); }}><Plus size={16} /> Add deal</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((st) => (
          <div key={st.key} className="w-64 flex-none">
            <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: st.color }}>
              <span className="text-sm font-semibold" style={{ color: '#1f2430' }}>{st.label}</span>
              <span className="text-xs font-medium" style={{ color: '#1f2430' }}>{byStage(st.key).length}{colValue(st.key) > 0 ? ` · ${money(colValue(st.key))}` : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              {byStage(st.key).map((d) => (
                <div key={d.id} className="rounded-xl border border-line bg-card p-3">
                  <div className="text-sm font-semibold text-ink">{d.prospectName}</div>
                  {d.contactEmail && <div className="truncate text-xs text-muted">{d.contactEmail}</div>}
                  <div className="mt-1 text-xs text-muted">{d.expectedUnits || 0} units · {money(d.expectedMrr || 0)}/mo</div>
                  {d.lostReason && st.key === 'lost' && <div className="mt-1 text-xs text-danger">“{d.lostReason}”</div>}
                  <select className="input mt-2 !py-1 text-xs" value={d.stage} onChange={(e) => move(d.id, e.target.value)}>
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              ))}
              {byStage(st.key).length === 0 && <div className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Empty</div>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add deal"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={add} loading={busy} disabled={!form.prospectName.trim()}>Add deal</Button></>}>
        <div className="grid gap-3">
          <Field label="Agency / prospect name"><input className="input" value={form.prospectName} onChange={(e) => setForm({ ...form, prospectName: e.target.value })} placeholder="Acme Rentals" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name"><input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Contact email"><input className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected units"><input className="input" inputMode="numeric" value={form.expectedUnits} onChange={(e) => setForm({ ...form, expectedUnits: e.target.value })} placeholder="25" /></Field>
            <Field label="Expected MRR (R)"><input className="input" inputMode="numeric" value={form.expectedMrr} onChange={(e) => setForm({ ...form, expectedMrr: e.target.value })} placeholder="6250" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
