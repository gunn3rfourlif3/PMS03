'use client';
import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, UserPlus, FileText, Copy, Check, ExternalLink } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, BentoTile } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import Pager from '@/components/pager';

export default function LeasesPage() {
  const router = useRouter();
  const { t, money, date } = useLocale();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const PAGE = 50;
  const [editing, setEditing] = useState<string | null>(null);
  const [pct, setPct] = useState('8');
  const [months, setMonths] = useState('12');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Add-tenant modal state
  const [showAdd, setShowAdd] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [rent, setRent] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [agentsList, setAgentsList] = useState<any[]>([]);

  const [agreements, setAgreements] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); load(); }, []);
  useEffect(() => { if (ready) load(); }, [offset]);

  const load = async () => {
    setErr('');
    try {
      const [leases, agrs] = await Promise.all([
        api.listLeasesPaged({ limit: PAGE, offset }),
        api.leaseAgreements().catch(() => []),
      ]);
      setRows(leases.rows ?? []);
      setTotal(leases.total ?? 0);
      // Latest agreement per lease (list is newest-first).
      const map: Record<string, any> = {};
      for (const a of agrs as any[]) if (!map[a.leaseId]) map[a.leaseId] = a;
      setAgreements(map);
    } catch (e: any) { setErr(e.message); }
  };

  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const sendLease = async (leaseId: string) => {
    setSendBusy(leaseId); setErr('');
    try { await api.sendLeaseForSigning(leaseId); await load(); } catch (e: any) { setErr(e.message); } finally { setSendBusy(null); }
  };
  const signLink = (ref: string) => (typeof window !== 'undefined' ? `${window.location.origin}/sign/${ref}` : `/sign/${ref}`);
  const copySign = async (ref: string) => {
    try { await navigator.clipboard.writeText(signLink(ref)); } catch { /* ignore */ }
    setCopied(ref); setTimeout(() => setCopied((c) => (c === ref ? null : c)), 1800);
  };

  const startRenew = (l: any) => { setEditing(l.id); setPct('8'); setMonths('12'); };
  const renew = async (id: string) => {
    setBusy(true); setErr('');
    try { await api.renewLease(id, Number(pct) || 0, Number(months) || 0); setEditing(null); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const openAdd = async () => {
    setName(''); setEmail(''); setPhone(''); setUnitId(''); setRent(''); setEnd('');
    setStart(new Date().toISOString().slice(0, 10)); setAddErr(''); setReferredBy(''); setShowAdd(true);
    try { setUnits(await api.units()); } catch { /* dropdown just stays empty */ }
    try { setAgentsList((await api.agents()).filter((a: any) => a.status === 'active')); } catch { /* optional */ }
  };
  const pickUnit = (id: string) => {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u && !rent && Number(u.marketRent) > 0) setRent(String(Math.round(Number(u.marketRent))));
  };
  const submitAdd = async () => {
    setAddBusy(true); setAddErr('');
    try {
      await api.addTenant({
        name, email, phone: phone || undefined, unitId,
        rentAmount: Number(rent) || 0, startDate: start, endDate: end || undefined,
        referredByAgentId: referredBy || undefined,
      });
      setShowAdd(false); await load();
    } catch (e: any) { setAddErr(e.message); } finally { setAddBusy(false); }
  };

  if (!ready) return null;
  const projected = (r: number) => Math.round(Number(r) * (1 + (Number(pct) || 0) / 100));
  const canAdd = !!email && !!unitId && !!rent && !!start;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={t('leases.title')} subtitle={t('leases.subtitle')} />
        <Button onClick={openAdd}><UserPlus size={16} /> {t('leases.addTenant')}</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="purple" value={String(rows.length)} label={t('leases.tile.active')} />
        <BentoTile tone="teal" value={money(rows.reduce((s, l) => s + Number(l.rent_amount || 0), 0))} label={t('leases.tile.rentRoll')} />
        <BentoTile tone="green" value={String(Object.values(agreements).filter((a: any) => a.status === 'signed').length)} label={t('leases.tile.signed')} />
        <BentoTile tone="amber" value={String(Object.values(agreements).filter((a: any) => a.status && a.status !== 'signed').length)} label={t('leases.tile.awaiting')} />
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('leases.th.unit')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.rent')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.type')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.start')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.end')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.status')}</th><th className="px-5 py-3 font-semibold">{t('leases.th.agreement')}</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((l) => (
                <Fragment key={l.id}>
                  <tr className="border-t border-line hover:bg-black/[0.02]">
                    <td className="px-5 py-3 font-medium">{l.unit}</td>
                    <td className="px-5 py-3">{money(l.rent_amount)}</td>
                    <td className="px-5 py-3 text-muted">{l.type}</td>
                    {/* Dates were printed as the API's raw ISO strings; they
                        now format per locale. */}
                    <td className="px-5 py-3 text-muted">{date(l.start_date)}</td>
                    <td className="px-5 py-3 text-muted">{l.end_date ? date(l.end_date) : t('common.none')}</td>
                    <td className="px-5 py-3"><Badge tone="success">{l.status}</Badge></td>
                    <td className="px-5 py-3">
                      {(() => {
                        const a = agreements[l.id];
                        if (!a) return (
                          <Button variant="ghost" onClick={() => sendLease(l.id)} loading={sendBusy === l.id}><FileText size={14} /> {t('leases.sendLease')}</Button>
                        );
                        if (a.status === 'signed') return (
                          <div className="flex items-center gap-2">
                            <Badge tone="success">{t('leases.signed')}</Badge>
                            <a href={a.fileUrl} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-black/5 hover:text-brand" title={t('leases.viewSigned')}><FileText size={14} /></a>
                          </div>
                        );
                        return (
                          <div className="flex items-center gap-1">
                            <Badge tone="brand">{t('leases.awaitingSignature')}</Badge>
                            <Button variant="ghost" onClick={() => copySign(a.ref)} title={t('leases.copySigningLink')}>
                              {copied === a.ref ? <Check size={13} /> : <Copy size={13} />}
                            </Button>
                            <a href={signLink(a.ref)} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-black/5 hover:text-brand" title={t('leases.openSigningPage')}><ExternalLink size={14} /></a>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3"><Button variant="ghost" onClick={() => startRenew(l)}><CalendarClock size={15} /> {t('leases.renew')}</Button></td>
                  </tr>
                  {editing === l.id && (
                    <tr className="bg-black/[0.03]">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-32"><Field label={t('leases.escalationPct')}><input className="input" value={pct} onChange={(e) => setPct(e.target.value)} /></Field></div>
                          <div className="w-32"><Field label={t('leases.extendMonths')}><input className="input" value={months} onChange={(e) => setMonths(e.target.value)} /></Field></div>
                          <div className="text-sm text-muted">{t('leases.newRent')}: <span className="font-semibold text-ink">{money(projected(l.rent_amount))}</span></div>
                          <Button onClick={() => renew(l.id)} loading={busy}>{t('leases.applyRenewal')}</Button>
                          <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}><EmptyState>{t('leases.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager total={total} limit={PAGE} offset={offset} onChange={setOffset} noun={t('leases.pagerNoun')} />
      </GlassCard>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('leases.addModalTitle')}
        footer={<>
          <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={addBusy}>{t('common.cancel')}</Button>
          <Button onClick={submitAdd} loading={addBusy} disabled={!canAdd}>{t('leases.addAndCreate')}</Button>
        </>}>
        {addErr && <div className="mb-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{addErr}</div>}
        <p className="mb-4 text-sm text-muted">{t('leases.addBlurb')}</p>
        <div className="grid gap-3">
          <Field label={t('leases.field.fullName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('leases.field.fullNamePlaceholder')} /></Field>
          <Field label={t('leases.field.email')}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('leases.field.emailPlaceholder')} /></Field>
          <Field label={t('leases.field.phone')}><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('leases.field.phonePlaceholder')} /></Field>
          <Field label={t('leases.field.unit')}>
            <select className="input" value={unitId} onChange={(e) => pickUnit(e.target.value)}>
              <option value="">{t('leases.field.unitPlaceholder')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.label}{u.status && u.status !== 'vacant' ? ` — ${u.status}` : ''}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('leases.field.rent')}><input className="input" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} placeholder={t('leases.field.rentPlaceholder')} /></Field>
            <Field label={t('leases.field.startDate')}><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          </div>
          <Field label={t('leases.field.endDate')}><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          {agentsList.length > 0 && (
            <Field label={t('leases.field.referredBy')}>
              <select className="input" value={referredBy} onChange={(e) => setReferredBy(e.target.value)}>
                <option value="">{t('leases.referredNone')}</option>
                {agentsList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
