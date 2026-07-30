'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, UserPlus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, Modal, EmptyState, money } from '@/components/ui';

const tierTone = (t: string): 'success' | 'brand' | 'muted' => (t === 'growth' ? 'success' : t === 'enterprise' ? 'brand' : 'muted');
const blank = () => ({ agencyName: '', ownerName: '', ownerEmail: '', expectedUnits: '' });

export default function AgenciesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [ref, setRef] = useState<{ refCode: string; signupUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [a, r] = await Promise.all([api.partnerAgencies(), api.partnerReferral()]);
      setRows(a); setRef(r);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const copy = async () => {
    if (!ref) return;
    try { await navigator.clipboard.writeText(ref.signupUrl); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const add = async () => {
    if (!form.agencyName.trim() || !form.ownerEmail.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.onboardAgency({ agencyName: form.agencyName.trim(), ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim(), expectedUnits: Number(form.expectedUnits) || 0 });
      setShowAdd(false); setForm(blank()); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Agencies" subtitle="Agencies you've referred and your referral link" />
        <Button onClick={() => { setForm(blank()); setShowAdd(true); }}><UserPlus size={16} /> Add agency</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="mb-4">
        <div className="mb-1 font-heading text-base font-bold text-ink">Your referral link</div>
        <p className="mb-3 text-sm text-muted">Share this — agencies who sign up through it are attributed to you (after admin approval).</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-sm">{ref?.signupUrl}</code>
          <Button variant="ghost" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</Button>
        </div>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-base font-bold text-ink">Referred agencies</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Agency</th><th className="px-5 py-3 font-semibold">Tier</th><th className="px-5 py-3 font-semibold">Units</th><th className="px-5 py-3 font-semibold">MRR</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Joined</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendorId} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{r.agencyName}</td>
                  <td className="px-5 py-3"><Badge tone={tierTone(r.tier)}>{r.tier}</Badge></td>
                  <td className="px-5 py-3">{r.unitCount}</td>
                  <td className="px-5 py-3">{money(r.mrr)}</td>
                  <td className="px-5 py-3 text-muted">{r.status}</td>
                  <td className="px-5 py-3 text-muted">{r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('en-ZA') : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>No agencies yet — add one or share your link.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add agency"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={add} loading={busy} disabled={!form.agencyName.trim() || !form.ownerEmail.trim()}>Create agency</Button></>}>
        <p className="mb-4 text-sm text-muted">Creates the agency and its owner login, attributed to you. They sign in with their email.</p>
        <div className="grid gap-3">
          <Field label="Agency name"><input className="input" value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} placeholder="Acme Rentals" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner name"><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></Field>
            <Field label="Owner email"><input className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="owner@acme.co.za" /></Field>
          </div>
          <Field label="Expected units (optional)"><input className="input" inputMode="numeric" value={form.expectedUnits} onChange={(e) => setForm({ ...form, expectedUnits: e.target.value })} placeholder="25" /></Field>
        </div>
      </Modal>
    </div>
  );
}
