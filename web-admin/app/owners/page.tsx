'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, FileText, Landmark } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, money } from '@/components/ui';

const thisPeriod = () => new Date().toISOString().slice(0, 7);
const statusLabel: Record<string, string> = { finalized: 'Ready to pay', paid_out: 'Paid out' };

export default function OwnersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [owners, setOwners] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [fee, setFee] = useState('0.10');
  const [period, setPeriod] = useState(thisPeriod());
  const [selected, setSelected] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [bankingOwner, setBankingOwner] = useState<any>(null);
  const [bank, setBank] = useState<any>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);

  const load = async () => { setErr(''); try { setOwners(await api.owners()); } catch (e: any) { setErr(e.message); } };
  const create = async () => {
    setBusy(true); setErr('');
    try { await api.createOwner({ name, managementFeePct: Number(fee) }); setName(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const open = async (owner: any) => {
    setSelected(owner); setStatements([]); setErr('');
    try { setStatements(await api.ownerStatements(owner.id)); } catch (e: any) { setErr(e.message); }
  };
  const generate = async () => {
    if (!selected) return; setBusy(true); setErr('');
    try { await api.generateStatement(selected.id, period); await open(selected); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const openBanking = (o: any) => { setBankingOwner(o); setBank(o.banking ?? {}); };
  const setB = (k: string, v: string) => setBank((b: any) => ({ ...b, [k]: v }));
  const saveBanking = async () => {
    setBusy(true); setErr('');
    try {
      const updated = await api.updateOwnerBanking(bankingOwner.id, bank);
      if (selected?.id === bankingOwner.id) setSelected(updated);
      setBankingOwner(null); await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const payout = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.payoutStatement(id); await open(selected); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Owners" subtitle="Manage owners, generate statements, and pay out" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">Add owner</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1"><Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Property Holdings" /></Field></div>
          <div className="w-40"><Field label="Mgmt fee (fraction)"><input className="input" value={fee} onChange={(e) => setFee(e.target.value)} /></Field></div>
          <Button onClick={create} loading={busy} disabled={!name}><UserPlus size={16} /> Add</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">Owners</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Mgmt fee</th><th className="px-5 py-3 font-semibold">Payout account</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id} className={`border-t border-white/40 hover:bg-white/30 ${selected?.id === o.id ? 'bg-white/40' : ''}`}>
                  <td className="px-5 py-3 font-medium">{o.name}</td>
                  <td className="px-5 py-3">{Math.round(Number(o.managementFeePct) * 100)}%</td>
                  <td className="px-5 py-3">{o.payoutSubaccount || '—'}</td>
                  <td className="px-5 py-3"><div className="flex gap-2"><Button variant="ghost" onClick={() => open(o)}><FileText size={15} /> Statements</Button><Button variant="ghost" onClick={() => openBanking(o)}><Landmark size={15} /> Banking</Button></div></td>
                </tr>
              ))}
              {owners.length === 0 && <tr><td colSpan={4}><EmptyState>No owners yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {selected && (
        <GlassCard className="mt-4 !p-0 overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5">
            <div>
              <div className="font-heading text-lg font-bold">{selected.name} · statements</div>
              {selected.banking?.accountNumber
                ? <div className="mt-1 text-sm text-muted">Payouts to {selected.banking.bankName ?? 'bank'} ••{String(selected.banking.accountNumber).slice(-4)}</div>
                : <button onClick={() => openBanking(selected)} className="mt-1 text-sm text-danger underline">No banking details — add them to enable payouts</button>}
            </div>
            <div className="flex items-end gap-2">
              <div className="w-32"><Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
              <Button onClick={generate} loading={busy}>Generate</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                {['Period','Gross','Mgmt fee','Expenses','Net payout','Status',''].map((h, i) => <th key={i} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {statements.map((st) => (
                  <tr key={st.id} className="border-t border-white/40 hover:bg-white/30">
                    <td className="px-5 py-3">{st.period}</td>
                    <td className="px-5 py-3">{money(st.grossCollected)}</td>
                    <td className="px-5 py-3">{money(st.managementFee)}</td>
                    <td className="px-5 py-3">{money(st.expenses)}</td>
                    <td className="px-5 py-3 font-bold">{money(st.netPayout)}</td>
                    <td className="px-5 py-3"><Badge tone={st.status === 'paid_out' ? 'success' : 'danger'}>{statusLabel[st.status] ?? st.status}</Badge></td>
                    <td className="px-5 py-3">{st.status === 'finalized' && Number(st.netPayout) > 0
                      ? (selected.banking?.accountNumber
                          ? <Button onClick={() => payout(st.id)} loading={busy}>Pay out</Button>
                          : <span className="text-xs text-danger">Add banking first</span>)
                      : null}</td>
                  </tr>
                ))}
                {statements.length === 0 && <tr><td colSpan={7}><EmptyState>No statements yet — generate one for a period.</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
      {bankingOwner && (
        <GlassCard className="mt-4">
          <div className="mb-3 font-heading text-lg font-bold">{bankingOwner.name} · banking details</div>
          <p className="mb-4 text-sm text-muted">Where this owner receives their rent payouts. Stored against the owner record.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank"><input className="input" value={bank.bankName ?? ''} onChange={(e) => setB('bankName', e.target.value)} placeholder="FNB" /></Field>
            <Field label="Account holder"><input className="input" value={bank.accountHolder ?? ''} onChange={(e) => setB('accountHolder', e.target.value)} /></Field>
            <Field label="Account number"><input className="input" value={bank.accountNumber ?? ''} onChange={(e) => setB('accountNumber', e.target.value)} /></Field>
            <Field label="Branch code"><input className="input" value={bank.branchCode ?? ''} onChange={(e) => setB('branchCode', e.target.value)} /></Field>
            <Field label="Account type"><input className="input" value={bank.accountType ?? ''} onChange={(e) => setB('accountType', e.target.value)} placeholder="Cheque / Savings" /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveBanking} loading={busy}>Save banking</Button>
            <Button variant="ghost" onClick={() => setBankingOwner(null)}>Cancel</Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
