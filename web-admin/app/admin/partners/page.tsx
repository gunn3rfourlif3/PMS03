'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, Modal, EmptyState } from '@/components/ui';

const statusTone = (s: string): 'success' | 'muted' | 'danger' => (s === 'active' ? 'success' : s === 'suspended' ? 'danger' : 'muted');
const blankPartner = () => ({ name: '', contactEmail: '', contactPhone: '', company: '', commissionRate: '0.10' });

export default function AdminPartnersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blankPartner());
  const [memberFor, setMemberFor] = useState<any>(null);
  const [memberEmail, setMemberEmail] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try { setRows(await api.adminPartners()); } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.createPartner({ name: form.name.trim(), contactEmail: form.contactEmail.trim() || undefined, contactPhone: form.contactPhone.trim() || undefined, company: form.company.trim() || undefined, commissionRate: Number(form.commissionRate) || 0.10 });
      setShowAdd(false); setForm(blankPartner()); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await api.setPartnerStatus(id, status); await load(); } catch (e: any) { setErr(e.message); }
  };

  const addMember = async () => {
    if (!memberFor || !memberEmail.trim()) return;
    setBusy(true); setErr('');
    try { await api.addPartnerMember(memberFor.id, memberEmail.trim()); setMemberFor(null); setMemberEmail(''); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Partners" subtitle="Manage software resellers, their status and logins" />
        <Button onClick={() => { setForm(blankPartner()); setShowAdd(true); }}><Plus size={16} /> New partner</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Partner</th><th className="px-5 py-3 font-semibold">Ref code</th><th className="px-5 py-3 font-semibold">Rate</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{p.name}{p.company ? <span className="text-muted"> · {p.company}</span> : ''}</td>
                  <td className="px-5 py-3"><code className="rounded bg-black/[0.03] px-1.5 py-0.5 text-xs">{p.refCode}</code></td>
                  <td className="px-5 py-3">{Math.round(Number(p.commissionRate) * 100)}%</td>
                  <td className="px-5 py-3"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className="px-5 py-3 text-muted">{p.contactEmail ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onClick={() => { setMemberFor(p); setMemberEmail(p.contactEmail ?? ''); }}><UserPlus size={14} /> Grant login</Button>
                      {p.status !== 'active' && <Button variant="ghost" onClick={() => setStatus(p.id, 'active')}>Activate</Button>}
                      {p.status === 'active' && <Button variant="ghost" onClick={() => setStatus(p.id, 'suspended')}>Suspend</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>No partners yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New partner"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={create} loading={busy} disabled={!form.name.trim()}>Create partner</Button></>}>
        <div className="grid gap-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Reseller" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact email"><input className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
            <Field label="Contact phone"><input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Commission rate (0-1)"><input className="input" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal open={!!memberFor} onClose={() => setMemberFor(null)} title={`Grant login — ${memberFor?.name ?? ''}`}
        footer={<><Button variant="ghost" onClick={() => setMemberFor(null)}>Cancel</Button><Button onClick={addMember} loading={busy} disabled={!memberEmail.trim()}>Grant login</Button></>}>
        <p className="mb-3 text-sm text-muted">This email will sign in (passwordless OTP) and land in the partner portal.</p>
        <Field label="Login email"><input className="input" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="jane@example.com" /></Field>
      </Modal>
    </div>
  );
}
