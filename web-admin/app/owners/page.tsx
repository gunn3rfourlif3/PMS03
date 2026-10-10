'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, FileText, Landmark } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, BentoTile } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const thisPeriod = () => new Date().toISOString().slice(0, 7);
/* Was a Record of English strings. Unknown statuses still render as
   themselves, exactly as `statusLabel[st.status] ?? st.status` did. */
const STATUSES = ['finalized', 'paid_out'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`owners.status.${st}` as MessageKey) : st;

export default function OwnersPage() {
  const router = useRouter();
  const { t, money, percent } = useLocale();
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
  const openBanking = async (o: any) => {
    setBankingOwner(o);
    // The list only carries a masked account number; fetch the full details to edit.
    try { setBank(await api.ownerBanking(o.id)); } catch { setBank(o.banking ?? {}); }
  };
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
      <PageHeader title={t('owners.title')} subtitle={t('owners.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <BentoTile tone="blue" value={String(owners.length)} label={t('owners.tile.owners')} />
        <BentoTile tone="teal"
          value={owners.length
            ? percent(owners.reduce((sum, o) => sum + Number((o as any).managementFeePct || 0), 0) / owners.length, 0)
            : t('common.none')}
          label={t('owners.tile.avgFee')} />
        <BentoTile tone="green" value={String(owners.filter((o) => (o as any).banking?.accountNumber).length)} label={t('owners.tile.bankingOnFile')} />
      </div>

      <GlassCard>
        <div className="mb-3 font-heading text-lg font-bold">{t('owners.add')}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1"><Field label={t('owners.field.name')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('owners.field.namePlaceholder')} /></Field></div>
          <div className="w-40"><Field label={t('owners.field.fee')}><input className="input" value={fee} onChange={(e) => setFee(e.target.value)} /></Field></div>
          <Button onClick={create} loading={busy} disabled={!name}><UserPlus size={16} /> {t('owners.addButton')}</Button>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-lg font-bold">{t('owners.listTitle')}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('owners.th.name')}</th><th className="px-5 py-3 font-semibold">{t('owners.th.fee')}</th><th className="px-5 py-3 font-semibold">{t('owners.th.payoutAccount')}</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id} className={`border-t border-line hover:bg-black/[0.02] ${selected?.id === o.id ? 'bg-black/[0.03]' : ''}`}>
                  <td className="px-5 py-3 font-medium">{o.name}</td>
                  <td className="px-5 py-3">{percent(Number(o.managementFeePct), 0)}</td>
                  <td className="px-5 py-3">{o.payoutSubaccount || t('common.none')}</td>
                  <td className="px-5 py-3"><div className="flex gap-2"><Button variant="ghost" onClick={() => open(o)}><FileText size={15} /> {t('owners.statements')}</Button><Button variant="ghost" onClick={() => openBanking(o)}><Landmark size={15} /> {t('owners.banking')}</Button></div></td>
                </tr>
              ))}
              {owners.length === 0 && <tr><td colSpan={4}><EmptyState>{t('owners.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {selected && (
        <GlassCard className="mt-4 !p-0 overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5">
            <div>
              <div className="font-heading text-lg font-bold">{t('owners.statementsFor', { name: selected.name })}</div>
              {selected.banking?.accountNumber
                ? <div className="mt-1 text-sm text-muted">{t('owners.payoutsTo', {
                    bank: selected.banking.bankName ?? t('owners.bankFallback'),
                    last4: String(selected.banking.accountNumber).slice(-4),
                  })}</div>
                : <button onClick={() => openBanking(selected)} className="mt-1 text-sm text-danger underline">{t('owners.noBanking')}</button>}
            </div>
            <div className="flex items-end gap-2">
              <div className="w-32"><Field label={t('owners.period')}><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
              <Button onClick={generate} loading={busy}>{t('owners.generate')}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
                {/* The trailing empty header is the actions column and has no
                    label; it stays an empty string rather than a blank key. */}
                {(['owners.st.th.period','owners.st.th.gross','owners.st.th.fee','owners.st.th.expenses','owners.st.th.netPayout','owners.st.th.status'] as const)
                  .map((h) => <th key={h} className="px-5 py-3 font-semibold">{t(h)}</th>)}
                <th className="px-5 py-3 font-semibold" />
              </tr></thead>
              <tbody>
                {statements.map((st) => (
                  <tr key={st.id} className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3">{st.period}</td>
                    <td className="px-5 py-3">{money(st.grossCollected)}</td>
                    <td className="px-5 py-3">{money(st.managementFee)}</td>
                    <td className="px-5 py-3">{money(st.expenses)}</td>
                    <td className="px-5 py-3 font-bold">{money(st.netPayout)}</td>
                    <td className="px-5 py-3"><Badge tone={st.status === 'paid_out' ? 'success' : 'danger'}>{statusLabel(t, st.status)}</Badge></td>
                    <td className="px-5 py-3">{st.status === 'finalized' && Number(st.netPayout) > 0
                      ? (selected.banking?.accountNumber
                          ? <Button onClick={() => payout(st.id)} loading={busy}>{t('owners.payOut')}</Button>
                          : <span className="text-xs text-danger">{t('owners.addBankingFirst')}</span>)
                      : null}</td>
                  </tr>
                ))}
                {statements.length === 0 && <tr><td colSpan={7}><EmptyState>{t('owners.noStatements')}</EmptyState></td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
      {bankingOwner && (
        <GlassCard className="mt-4">
          <div className="mb-3 font-heading text-lg font-bold">{t('owners.bankingFor', { name: bankingOwner.name })}</div>
          <p className="mb-4 text-sm text-muted">{t('owners.bankingBlurb')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* "FNB" is a bank's name, not a word — it stays as written. */}
            <Field label={t('owners.field.bank')}><input className="input" value={bank.bankName ?? ''} onChange={(e) => setB('bankName', e.target.value)} placeholder="FNB" /></Field>
            <Field label={t('owners.field.accountHolder')}><input className="input" value={bank.accountHolder ?? ''} onChange={(e) => setB('accountHolder', e.target.value)} /></Field>
            <Field label={t('owners.field.accountNumber')}><input className="input" value={bank.accountNumber ?? ''} onChange={(e) => setB('accountNumber', e.target.value)} /></Field>
            <Field label={t('owners.field.branchCode')}><input className="input" value={bank.branchCode ?? ''} onChange={(e) => setB('branchCode', e.target.value)} /></Field>
            <Field label={t('owners.field.accountType')}><input className="input" value={bank.accountType ?? ''} onChange={(e) => setB('accountType', e.target.value)} placeholder={t('owners.field.accountTypePlaceholder')} /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveBanking} loading={busy}>{t('owners.saveBanking')}</Button>
            <Button variant="ghost" onClick={() => setBankingOwner(null)}>{t('common.cancel')}</Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
