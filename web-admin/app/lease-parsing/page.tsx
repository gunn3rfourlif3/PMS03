'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Sparkles, AlertTriangle, Check } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey } from '@shared/i18n';

export default function LeaseParsingPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [rec, setRec] = useState<any | null>(null);
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({ name: '', email: '', phone: '', unitId: '', rent: '', start: '', end: '', deposit: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.units().then(setUnits).catch(() => {});
  }, []);

  const parse = async (file?: File) => {
    if (!file) return;
    setParsing(true); setErr(''); setDone(false); setRec(null);
    try {
      const r = await api.parseLeasePdf(file);
      setRec(r);
      const ex = r.extracted ?? {};
      setF({
        name: ex.tenantName ?? '', email: ex.tenantEmail ?? '', phone: ex.tenantPhone ?? '',
        unitId: '', rent: ex.monthlyRent ? String(ex.monthlyRent) : '',
        start: ex.startDate ?? '', end: ex.endDate ?? '', deposit: ex.deposit ? String(ex.deposit) : '',
      });
    } catch (e: any) { setErr(e.message); } finally { setParsing(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      await api.addTenant({ name: f.name, email: f.email, phone: f.phone || undefined, unitId: f.unitId, rentAmount: Number(f.rent) || 0, startDate: f.start, endDate: f.end || undefined });
      await api.confirmExtraction(rec.id).catch(() => {});
      setDone(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const ex = rec?.extracted ?? {};
  const conf = typeof ex.confidence === 'number' ? Math.round(ex.confidence * 100) : null;
  const canConfirm = !!f.name && !!f.email && !!f.unitId && !!f.rent && !!f.start;

  return (
    <div>
      <PageHeader title={t('leaseImport.title')} subtitle={t('leaseImport.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {!rec && (
        <GlassCard className="text-center">
          <div className="mx-auto max-w-md py-6">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Sparkles size={26} /></div>
            <div className="font-heading text-lg font-bold text-ink">{t('leaseImport.uploadTitle')}</div>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t('leaseImport.uploadBlurb')}</p>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => parse(e.target.files?.[0])} />
            <Button className="mt-5" onClick={() => fileRef.current?.click()} loading={parsing}><FileUp size={16} /> {t('leaseImport.choosePdf')}</Button>
          </div>
        </GlassCard>
      )}

      {rec && done && (
        <GlassCard className="text-center">
          <div className="py-6">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success"><Check size={24} /></div>
            <div className="font-heading text-xl font-bold text-ink">{t('leaseImport.created')}</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('leaseImport.createdBlurb', { name: f.name })}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="ghost" onClick={() => { setRec(null); setDone(false); }}>{t('leaseImport.another')}</Button>
              <Button onClick={() => router.push('/leases')}>{t('leaseImport.goToLeases')}</Button>
            </div>
          </div>
        </GlassCard>
      )}

      {rec && !done && (
        <>
          {rec.status === 'failed' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 flex-none" /> <span>{t('leaseImport.readFailed', { error: rec.error })}</span>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: the document */}
            <GlassCard className="!p-2">
              <iframe title={t('leaseImport.document')} src={rec.sourceUrl} className="h-[72vh] w-full rounded-xl border border-line bg-white" />
            </GlassCard>

            {/* Right: extracted, editable */}
            <GlassCard>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-heading text-lg font-bold text-ink">{t('leaseImport.review')}</div>
                {conf != null && <Badge tone={conf >= 70 ? 'success' : conf >= 40 ? 'brand' : 'danger'}>{t('leaseImport.confidence', { pct: conf, provider: rec.provider })}</Badge>}
              </div>
              <p className="mb-4 text-sm text-muted">{t('leaseImport.reviewBlurb')}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${t('leaseImport.f.name')} *`}><input className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
                <Field label={`${t('leaseImport.f.email')} *`}><input className="input" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
                <Field label={t('leaseImport.f.phone')}><input className="input" value={f.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
                <Field label={`${t('leaseImport.f.unit')} *`}>
                  <select className="input" value={f.unitId} onChange={(e) => set('unitId')(e.target.value)}>
                    <option value="">{t('leaseImport.selectUnit')}</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.label}{u.status && u.status !== 'vacant' ? ` — ${t(`properties.status.${u.status}` as MessageKey)}` : ''}</option>)}
                  </select>
                </Field>
                <Field label={`${t('leaseImport.f.rent')} *`}><input className="input" inputMode="numeric" value={f.rent} onChange={(e) => set('rent')(e.target.value)} /></Field>
                <Field label={t('leaseImport.f.deposit')}><input className="input" inputMode="numeric" value={f.deposit} onChange={(e) => set('deposit')(e.target.value)} /></Field>
                <Field label={`${t('leaseImport.f.start')} *`}><input className="input" type="date" value={f.start} onChange={(e) => set('start')(e.target.value)} /></Field>
                <Field label={t('leaseImport.f.end')}><input className="input" type="date" value={f.end} onChange={(e) => set('end')(e.target.value)} /></Field>
              </div>

              {Array.isArray(ex.flaggedClauses) && ex.flaggedClauses.length > 0 && (
                <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink"><AlertTriangle size={14} /> {t('leaseImport.flagged')}</div>
                  <ul className="list-disc pl-5 text-sm text-ink/80">{ex.flaggedClauses.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              <Button className="mt-5 w-full" onClick={confirm} loading={busy} disabled={!canConfirm}>{t('leaseImport.confirm')}</Button>
              <p className="mt-2 text-center text-xs text-muted">{t('leaseImport.confirmBlurb')}</p>
            </GlassCard>
          </div>
        </>
      )}

      {!rec && !parsing && (
        <div className="mt-4"><EmptyState>{t('leaseImport.tip')}</EmptyState></div>
      )}
    </div>
  );
}
