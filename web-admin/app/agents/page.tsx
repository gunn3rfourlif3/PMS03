'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Plus, Check, X, Banknote, FileText } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, money } from '@/components/ui';

const blankAgent = () => ({ id: '', name: '', email: '', phone: '', company: '', commissionType: 'flat', commissionValue: '', banking: { bankName: '', accountHolder: '', accountNumber: '', branchCode: '' }, notes: '' });
const terms = (a: any) => a.commissionType === 'percent_first_month' ? `${a.commissionValue}% of 1st month` : `${money(a.commissionValue)} flat`;
const cTone = (s: string): 'brand' | 'success' | 'muted' | 'danger' => s === 'paid' ? 'success' : s === 'approved' ? 'brand' : s === 'cancelled' ? 'muted' : 'brand';

export default function AgentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'agents' | 'commissions'>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [cFilter, setCFilter] = useState('pending');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const [agentModal, setAgentModal] = useState<any | null>(null);
  const [commFor, setCommFor] = useState<any | null>(null);
  const [comm, setComm] = useState({ type: 'tenant', sourceLabel: '', amount: '' });
  const [payFor, setPayFor] = useState<any | null>(null);
  const [payRef, setPayRef] = useState('');
  const [stmt, setStmt] = useState<any | null>(null);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); loadAgents(); }, []);
  useEffect(() => { if (ready && tab === 'commissions') loadComms(); }, [ready, tab, cFilter]);

  const loadAgents = async () => { setErr(''); try { setAgents(await api.agents()); } catch (e: any) { setErr(e.message); } };
  const loadComms = async () => { setErr(''); try { setComms(await api.agentCommissions(undefined, cFilter === 'all' ? undefined : cFilter)); } catch (e: any) { setErr(e.message); } };

  const saveAgent = async () => {
    const a = agentModal;
    setBusy('agent'); setErr('');
    try {
      const body = { name: a.name, email: a.email || undefined, phone: a.phone || undefined, company: a.company || undefined, commissionType: a.commissionType, commissionValue: Number(a.commissionValue) || 0, banking: a.banking, notes: a.notes || undefined };
      if (a.id) await api.updateAgent(a.id, body); else await api.createAgent(body);
      setAgentModal(null); await loadAgents();
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const toggleStatus = async (a: any) => { setBusy(a.id); try { await api.setAgentStatus(a.id, a.status === 'active' ? 'inactive' : 'active'); await loadAgents(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } };

  const saveComm = async () => {
    setBusy('comm'); setErr('');
    try { await api.recordCommission({ agentId: commFor.id, type: comm.type, sourceLabel: comm.sourceLabel, amount: comm.amount ? Number(comm.amount) : undefined }); setCommFor(null); setComm({ type: 'tenant', sourceLabel: '', amount: '' }); if (tab === 'commissions') await loadComms(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const act = async (fn: Promise<any>, id: string) => { setBusy(id); setErr(''); try { await fn; await loadComms(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } };
  const doPay = async () => { setBusy(payFor.id); setErr(''); try { await api.payCommission(payFor.id, payRef); setPayFor(null); setPayRef(''); await loadComms(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); } };
  const openStatement = async (a: any) => { try { setStmt(await api.agentStatement(a.id)); } catch (e: any) { setErr(e.message); } };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Agents" subtitle="Referral partners and their commissions" />
        {tab === 'agents' && <Button onClick={() => setAgentModal(blankAgent())}><Plus size={16} /> Add agent</Button>}
      </div>

      <div className="mb-4 flex gap-2">
        {(['agents', 'commissions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${tab === t ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>{t}</button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {tab === 'agents' && (
        <GlassCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Agent</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3 font-semibold">Commission</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3"><div className="font-medium text-ink">{a.name}</div>{a.company && <div className="text-xs text-muted">{a.company}</div>}</td>
                    <td className="px-5 py-3 text-muted">{a.email || '—'}{a.phone ? ` · ${a.phone}` : ''}</td>
                    <td className="px-5 py-3">{terms(a)}</td>
                    <td className="px-5 py-3"><Badge tone={a.status === 'active' ? 'success' : 'muted'}>{a.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" onClick={() => setCommFor(a)}><Plus size={13} /> Commission</Button>
                        <Button variant="ghost" onClick={() => openStatement(a)}><FileText size={13} /> Statement</Button>
                        <Button variant="ghost" onClick={() => setAgentModal({ ...blankAgent(), ...a, banking: { ...blankAgent().banking, ...(a.banking || {}) } })}>Edit</Button>
                        <Button variant="ghost" onClick={() => toggleStatus(a)} loading={busy === a.id}>{a.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && <tr><td colSpan={5}><EmptyState>No agents yet — add your first referral partner.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {tab === 'commissions' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {['pending', 'approved', 'paid', 'all'].map((s) => (
              <button key={s} onClick={() => setCFilter(s)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${cFilter === s ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>{s}</button>
            ))}
          </div>
          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Agent</th><th className="px-5 py-3 font-semibold">For</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3"></th>
                </tr></thead>
                <tbody>
                  {comms.map((c) => (
                    <tr key={c.id} className="border-t border-line hover:bg-black/[0.02]">
                      <td className="px-5 py-3 font-medium">{c.agentName}</td>
                      <td className="px-5 py-3 text-muted"><span className="capitalize">{c.type}</span> · {c.sourceLabel}</td>
                      <td className="px-5 py-3 font-medium">{money(c.amount)}</td>
                      <td className="px-5 py-3"><Badge tone={cTone(c.status)}>{c.status}</Badge>{c.paidRef ? <span className="ml-1 text-xs text-muted">{c.paidRef}</span> : ''}</td>
                      <td className="px-5 py-3 text-muted">{String(c.createdAt).slice(0, 10)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.status === 'pending' && <Button variant="ghost" onClick={() => act(api.approveCommission(c.id), c.id)} loading={busy === c.id}><Check size={13} /> Approve</Button>}
                          {(c.status === 'pending' || c.status === 'approved') && <Button variant="ghost" onClick={() => setPayFor(c)}><Banknote size={13} /> Mark paid</Button>}
                          {c.status !== 'paid' && c.status !== 'cancelled' && <Button variant="ghost" onClick={() => act(api.cancelCommission(c.id), c.id)}><X size={13} /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {comms.length === 0 && <tr><td colSpan={6}><EmptyState>No {cFilter === 'all' ? '' : cFilter} commissions.</EmptyState></td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {/* Add / edit agent */}
      <Modal open={!!agentModal} onClose={() => setAgentModal(null)} title={agentModal?.id ? 'Edit agent' : 'Add agent'}
        footer={<><Button variant="ghost" onClick={() => setAgentModal(null)}>Cancel</Button><Button onClick={saveAgent} loading={busy === 'agent'} disabled={!agentModal?.name}>Save</Button></>}>
        {agentModal && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className="input" value={agentModal.name} onChange={(e) => setAgentModal({ ...agentModal, name: e.target.value })} /></Field>
            <Field label="Company"><input className="input" value={agentModal.company} onChange={(e) => setAgentModal({ ...agentModal, company: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={agentModal.email} onChange={(e) => setAgentModal({ ...agentModal, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={agentModal.phone} onChange={(e) => setAgentModal({ ...agentModal, phone: e.target.value })} /></Field>
            <Field label="Commission type">
              <select className="input" value={agentModal.commissionType} onChange={(e) => setAgentModal({ ...agentModal, commissionType: e.target.value })}>
                <option value="flat">Flat amount (R)</option>
                <option value="percent_first_month">% of first month’s rent</option>
              </select>
            </Field>
            <Field label={agentModal.commissionType === 'flat' ? 'Amount (R)' : 'Percentage'}><input className="input" inputMode="numeric" value={agentModal.commissionValue} onChange={(e) => setAgentModal({ ...agentModal, commissionValue: e.target.value })} /></Field>
            <div className="sm:col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Banking (for payouts)</div>
            <Field label="Bank"><input className="input" value={agentModal.banking.bankName} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, bankName: e.target.value } })} /></Field>
            <Field label="Account holder"><input className="input" value={agentModal.banking.accountHolder} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, accountHolder: e.target.value } })} /></Field>
            <Field label="Account number"><input className="input" value={agentModal.banking.accountNumber} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, accountNumber: e.target.value } })} /></Field>
            <Field label="Branch code"><input className="input" value={agentModal.banking.branchCode} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, branchCode: e.target.value } })} /></Field>
          </div>
        )}
      </Modal>

      {/* Record commission */}
      <Modal open={!!commFor} onClose={() => setCommFor(null)} title={`Record commission — ${commFor?.name ?? ''}`}
        footer={<><Button variant="ghost" onClick={() => setCommFor(null)}>Cancel</Button><Button onClick={saveComm} loading={busy === 'comm'} disabled={!comm.sourceLabel}>Record</Button></>}>
        <div className="grid gap-3">
          <Field label="Type"><select className="input" value={comm.type} onChange={(e) => setComm({ ...comm, type: e.target.value })}><option value="tenant">Tenant referral</option><option value="property">Property referral</option></select></Field>
          <Field label="For (property or tenant)"><input className="input" value={comm.sourceLabel} onChange={(e) => setComm({ ...comm, sourceLabel: e.target.value })} placeholder="e.g. 46 Saint James, Unit A-101 / Jane Doe" /></Field>
          <Field label={`Amount (R) — leave blank to use the agent’s default (${commFor ? terms(commFor) : ''})`}><input className="input" inputMode="numeric" value={comm.amount} onChange={(e) => setComm({ ...comm, amount: e.target.value })} placeholder="Optional" /></Field>
        </div>
      </Modal>

      {/* Mark paid */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Mark commission paid"
        footer={<><Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button><Button onClick={doPay} loading={busy === payFor?.id}>Mark paid</Button></>}>
        <p className="mb-3 text-sm text-muted">{payFor && `${money(payFor.amount)} to ${payFor.agentName}`}</p>
        <Field label="Payment reference (optional)"><input className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="EFT reference" /></Field>
      </Modal>

      {/* Statement */}
      <Modal open={!!stmt} onClose={() => setStmt(null)} title={`Statement — ${stmt?.agent?.name ?? ''}`}
        footer={<Button variant="ghost" onClick={() => setStmt(null)}>Close</Button>}>
        {stmt && (
          <div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">Pending</div><div className="font-heading text-lg font-bold">{money(stmt.totals.pending)}</div></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">Approved</div><div className="font-heading text-lg font-bold">{money(stmt.totals.approved)}</div></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">Paid</div><div className="font-heading text-lg font-bold text-success">{money(stmt.totals.paid)}</div></div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto">
              {stmt.commissions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between border-b border-line py-2 text-sm">
                  <span><span className="capitalize">{c.type}</span> · {c.sourceLabel}</span>
                  <span className="flex items-center gap-2">{money(c.amount)} <Badge tone={cTone(c.status)}>{c.status}</Badge></span>
                </div>
              ))}
              {stmt.commissions.length === 0 && <p className="py-4 text-center text-sm text-muted">No commissions yet.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
