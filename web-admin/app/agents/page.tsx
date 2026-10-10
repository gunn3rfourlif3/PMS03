'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Plus, Check, X, Banknote, FileText } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, BentoTile } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const blankAgent = () => ({ id: '', name: '', email: '', phone: '', company: '', commissionType: 'flat', commissionValue: '', banking: { bankName: '', accountHolder: '', accountNumber: '', branchCode: '' }, notes: '' });
/* Takes the translator and the locale's money formatter rather than closing
   over the module-level one, which could not know the active locale. */
const terms = (t: TFunction, money: (n: number) => string, a: any): string =>
  a.commissionType === 'percent_first_month'
    ? t('agents.terms.percentFirstMonth', { value: a.commissionValue })
    : t('agents.terms.flat', { amount: money(Number(a.commissionValue) || 0) });

const AGENT_STATUSES = ['active', 'inactive'] as const;
const agentStatusLabel = (t: TFunction, st: string): string =>
  (AGENT_STATUSES as readonly string[]).includes(st) ? t(`agents.status.${st}` as MessageKey) : st;

const COMM_STATUSES = ['pending', 'approved', 'paid', 'cancelled'] as const;
const commStatusLabel = (t: TFunction, st: string): string =>
  (COMM_STATUSES as readonly string[]).includes(st) ? t(`agents.comm.status.${st}` as MessageKey) : st;

const COMM_TYPES = ['tenant', 'property'] as const;
/* The commission `type` was rendered raw under a CSS `capitalize`, which does
   nothing outside the Latin alphabet. */
const commTypeLabel = (t: TFunction, ty: string): string =>
  (COMM_TYPES as readonly string[]).includes(ty) ? t(`agents.comm.type.${ty}` as MessageKey) : ty;

const COMM_FILTERS = ['pending', 'approved', 'paid', 'all'] as const;
const cTone = (s: string): 'brand' | 'success' | 'muted' | 'danger' => s === 'paid' ? 'success' : s === 'approved' ? 'brand' : s === 'cancelled' ? 'muted' : 'brand';

export default function AgentsPage() {
  const router = useRouter();
  const { t, money, date } = useLocale();
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
        <PageHeader title={t('agents.title')} subtitle={t('agents.subtitle')} />
        {tab === 'agents' && <Button onClick={() => setAgentModal(blankAgent())}><Plus size={16} /> {t('agents.addAgent')}</Button>}
      </div>

      <div className="mb-4 flex gap-2">
        {/* `tb`, not `t`: the map parameter would shadow the translator.
            `capitalize` is gone — it was doing the labelling. */}
        {(['agents', 'commissions'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === tb ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>{t(`agents.tab.${tb}` as MessageKey)}</button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {tab === 'agents' && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <BentoTile tone="purple" value={String(agents.length)} label={t('agents.tile.agents')} />
          <BentoTile tone="green" value={String(agents.filter((a) => a.status === 'active').length)} label={t('agents.tile.active')} />
          <BentoTile tone="amber" value={String(agents.filter((a) => a.status !== 'active').length)} label={t('agents.tile.inactive')} />
        </div>
      )}
      {tab === 'agents' && (
        <GlassCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">{t('agents.th.agent')}</th><th className="px-5 py-3 font-semibold">{t('agents.th.contact')}</th><th className="px-5 py-3 font-semibold">{t('agents.th.commission')}</th><th className="px-5 py-3 font-semibold">{t('agents.th.status')}</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3"><div className="font-medium text-ink">{a.name}</div>{a.company && <div className="text-xs text-muted">{a.company}</div>}</td>
                    <td className="px-5 py-3 text-muted">{a.email || t('common.none')}{a.phone ? ` · ${a.phone}` : ''}</td>
                    <td className="px-5 py-3">{terms(t, money, a)}</td>
                    <td className="px-5 py-3"><Badge tone={a.status === 'active' ? 'success' : 'muted'}>{agentStatusLabel(t, a.status)}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" onClick={() => setCommFor(a)}><Plus size={13} /> {t('agents.commission')}</Button>
                        <Button variant="ghost" onClick={() => openStatement(a)}><FileText size={13} /> {t('agents.statement')}</Button>
                        <Button variant="ghost" onClick={() => setAgentModal({ ...blankAgent(), ...a, banking: { ...blankAgent().banking, ...(a.banking || {}) } })}>{t('agents.edit')}</Button>
                        <Button variant="ghost" onClick={() => toggleStatus(a)} loading={busy === a.id}>{a.status === 'active' ? t('agents.deactivate') : t('agents.activate')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && <tr><td colSpan={5}><EmptyState>{t('agents.empty')}</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {tab === 'commissions' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {COMM_FILTERS.map((f) => (
              <button key={f} onClick={() => setCFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${cFilter === f ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>{t(`agents.filter.${f}` as MessageKey)}</button>
            ))}
          </div>
          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">{t('agents.comm.th.agent')}</th><th className="px-5 py-3 font-semibold">{t('agents.comm.th.for')}</th><th className="px-5 py-3 font-semibold">{t('agents.comm.th.amount')}</th><th className="px-5 py-3 font-semibold">{t('agents.comm.th.status')}</th><th className="px-5 py-3 font-semibold">{t('agents.comm.th.date')}</th><th className="px-5 py-3"></th>
                </tr></thead>
                <tbody>
                  {comms.map((c) => (
                    <tr key={c.id} className="border-t border-line hover:bg-black/[0.02]">
                      <td className="px-5 py-3 font-medium">{c.agentName}</td>
                      <td className="px-5 py-3 text-muted">{commTypeLabel(t, c.type)} · {c.sourceLabel}</td>
                      <td className="px-5 py-3 font-medium">{money(c.amount)}</td>
                      <td className="px-5 py-3"><Badge tone={cTone(c.status)}>{commStatusLabel(t, c.status)}</Badge>{c.paidRef ? <span className="ml-1 text-xs text-muted">{c.paidRef}</span> : ''}</td>
                      <td className="px-5 py-3 text-muted">{date(c.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.status === 'pending' && <Button variant="ghost" onClick={() => act(api.approveCommission(c.id), c.id)} loading={busy === c.id}><Check size={13} /> {t('agents.approve')}</Button>}
                          {(c.status === 'pending' || c.status === 'approved') && <Button variant="ghost" onClick={() => setPayFor(c)}><Banknote size={13} /> {t('agents.markPaid')}</Button>}
                          {c.status !== 'paid' && c.status !== 'cancelled' && <Button variant="ghost" onClick={() => act(api.cancelCommission(c.id), c.id)}><X size={13} /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {comms.length === 0 && <tr><td colSpan={6}><EmptyState>{cFilter === 'all'
                    ? t('agents.noCommissions')
                    : t('agents.noCommissionsFiltered', { status: commStatusLabel(t, cFilter).toLocaleLowerCase() })}</EmptyState></td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {/* Add / edit agent */}
      <Modal open={!!agentModal} onClose={() => setAgentModal(null)} title={agentModal?.id ? t('agents.editAgentTitle') : t('agents.addAgentTitle')}
        footer={<><Button variant="ghost" onClick={() => setAgentModal(null)}>{t('common.cancel')}</Button><Button onClick={saveAgent} loading={busy === 'agent'} disabled={!agentModal?.name}>{t('common.save')}</Button></>}>
        {agentModal && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('agents.field.name')}><input className="input" value={agentModal.name} onChange={(e) => setAgentModal({ ...agentModal, name: e.target.value })} /></Field>
            <Field label={t('agents.field.company')}><input className="input" value={agentModal.company} onChange={(e) => setAgentModal({ ...agentModal, company: e.target.value })} /></Field>
            <Field label={t('agents.field.email')}><input className="input" value={agentModal.email} onChange={(e) => setAgentModal({ ...agentModal, email: e.target.value })} /></Field>
            <Field label={t('agents.field.phone')}><input className="input" value={agentModal.phone} onChange={(e) => setAgentModal({ ...agentModal, phone: e.target.value })} /></Field>
            <Field label={t('agents.field.commissionType')}>
              <select className="input" value={agentModal.commissionType} onChange={(e) => setAgentModal({ ...agentModal, commissionType: e.target.value })}>
                <option value="flat">{t('agents.commissionType.flat')}</option>
                <option value="percent_first_month">{t('agents.commissionType.percent')}</option>
              </select>
            </Field>
            <Field label={agentModal.commissionType === 'flat' ? t('agents.field.amount') : t('agents.field.percentage')}><input className="input" inputMode="numeric" value={agentModal.commissionValue} onChange={(e) => setAgentModal({ ...agentModal, commissionValue: e.target.value })} /></Field>
            <div className="sm:col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('agents.bankingHeading')}</div>
            <Field label={t('agents.field.bank')}><input className="input" value={agentModal.banking.bankName} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, bankName: e.target.value } })} /></Field>
            <Field label={t('agents.field.accountHolder')}><input className="input" value={agentModal.banking.accountHolder} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, accountHolder: e.target.value } })} /></Field>
            <Field label={t('agents.field.accountNumber')}><input className="input" value={agentModal.banking.accountNumber} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, accountNumber: e.target.value } })} /></Field>
            <Field label={t('agents.field.branchCode')}><input className="input" value={agentModal.banking.branchCode} onChange={(e) => setAgentModal({ ...agentModal, banking: { ...agentModal.banking, branchCode: e.target.value } })} /></Field>
          </div>
        )}
      </Modal>

      {/* Record commission */}
      <Modal open={!!commFor} onClose={() => setCommFor(null)} title={t('agents.recordCommissionTitle', { name: commFor?.name ?? '' })}
        footer={<><Button variant="ghost" onClick={() => setCommFor(null)}>{t('common.cancel')}</Button><Button onClick={saveComm} loading={busy === 'comm'} disabled={!comm.sourceLabel}>{t('agents.record')}</Button></>}>
        <div className="grid gap-3">
          <Field label={t('agents.field.type')}><select className="input" value={comm.type} onChange={(e) => setComm({ ...comm, type: e.target.value })}><option value="tenant">{t('agents.commType.tenant')}</option><option value="property">{t('agents.commType.property')}</option></select></Field>
          <Field label={t('agents.field.for')}><input className="input" value={comm.sourceLabel} onChange={(e) => setComm({ ...comm, sourceLabel: e.target.value })} placeholder={t('agents.field.forPlaceholder')} /></Field>
          <Field label={t('agents.field.amountOrDefault', { terms: commFor ? terms(t, money, commFor) : '' })}><input className="input" inputMode="numeric" value={comm.amount} onChange={(e) => setComm({ ...comm, amount: e.target.value })} placeholder={t('agents.optional')} /></Field>
        </div>
      </Modal>

      {/* Mark paid */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={t('agents.markPaidTitle')}
        footer={<><Button variant="ghost" onClick={() => setPayFor(null)}>{t('common.cancel')}</Button><Button onClick={doPay} loading={busy === payFor?.id}>{t('agents.markPaid')}</Button></>}>
        <p className="mb-3 text-sm text-muted">{payFor && t('agents.payTo', { amount: money(payFor.amount), name: payFor.agentName })}</p>
        <Field label={t('agents.field.paymentRef')}><input className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={t('agents.field.paymentRefPlaceholder')} /></Field>
      </Modal>

      {/* Statement */}
      <Modal open={!!stmt} onClose={() => setStmt(null)} title={t('agents.statementTitle', { name: stmt?.agent?.name ?? '' })}
        footer={<Button variant="ghost" onClick={() => setStmt(null)}>{t('common.close')}</Button>}>
        {stmt && (
          <div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">{t('agents.total.pending')}</div><div className="font-heading text-lg font-bold">{money(stmt.totals.pending)}</div></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">{t('agents.total.approved')}</div><div className="font-heading text-lg font-bold">{money(stmt.totals.approved)}</div></div>
              <div className="rounded-xl bg-black/[0.03] p-3"><div className="text-xs text-muted">{t('agents.total.paid')}</div><div className="font-heading text-lg font-bold text-success">{money(stmt.totals.paid)}</div></div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto">
              {stmt.commissions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between border-b border-line py-2 text-sm">
                  <span>{commTypeLabel(t, c.type)} · {c.sourceLabel}</span>
                  <span className="flex items-center gap-2">{money(c.amount)} <Badge tone={cTone(c.status)}>{commStatusLabel(t, c.status)}</Badge></span>
                </div>
              ))}
              {stmt.commissions.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('agents.noCommissionsYet')}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
