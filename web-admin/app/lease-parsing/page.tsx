'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Sparkles, AlertTriangle, Check } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState } from '@/components/ui';

export default function LeaseParsingPage() {
  const router = useRouter();
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
      <PageHeader title="Import lease" subtitle="Upload a lease PDF — AI extracts the details for you to check and confirm" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {!rec && (
        <GlassCard className="text-center">
          <div className="mx-auto max-w-md py-6">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Sparkles size={26} /></div>
            <div className="font-heading text-lg font-bold text-ink">Upload a lease agreement (PDF)</div>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">We’ll read it and pull out the tenant, rent, dates and deposit. Nothing is saved until you review and confirm.</p>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => parse(e.target.files?.[0])} />
            <Button className="mt-5" onClick={() => fileRef.current?.click()} loading={parsing}><FileUp size={16} /> Choose PDF</Button>
          </div>
        </GlassCard>
      )}

      {rec && done && (
        <GlassCard className="text-center">
          <div className="py-6">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success"><Check size={24} /></div>
            <div className="font-heading text-xl font-bold text-ink">Tenant created ✓</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{f.name} has been onboarded, the first invoice raised, and their lease sent for signing.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="ghost" onClick={() => { setRec(null); setDone(false); }}>Import another</Button>
              <Button onClick={() => router.push('/leases')}>Go to Leases</Button>
            </div>
          </div>
        </GlassCard>
      )}

      {rec && !done && (
        <>
          {rec.status === 'failed' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 flex-none" /> <span>Couldn’t auto-read this file: {rec.error} You can still fill the form in manually below.</span>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: the document */}
            <GlassCard className="!p-2">
              <iframe title="Lease document" src={rec.sourceUrl} className="h-[72vh] w-full rounded-xl border border-white/40 bg-white" />
            </GlassCard>

            {/* Right: extracted, editable */}
            <GlassCard>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-heading text-lg font-bold text-ink">Review details</div>
                {conf != null && <Badge tone={conf >= 70 ? 'success' : conf >= 40 ? 'brand' : 'danger'}>{conf}% confidence · {rec.provider}</Badge>}
              </div>
              <p className="mb-4 text-sm text-muted">Check every field — AI can misread. Pick the matching unit, then confirm.</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tenant name *"><input className="input" value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
                <Field label="Email *"><input className="input" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
                <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
                <Field label="Unit *">
                  <select className="input" value={f.unitId} onChange={(e) => set('unitId')(e.target.value)}>
                    <option value="">Select a unit…</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.label}{u.status && u.status !== 'vacant' ? ` — ${u.status}` : ''}</option>)}
                  </select>
                </Field>
                <Field label="Monthly rent (R) *"><input className="input" inputMode="numeric" value={f.rent} onChange={(e) => set('rent')(e.target.value)} /></Field>
                <Field label="Deposit (R)"><input className="input" inputMode="numeric" value={f.deposit} onChange={(e) => set('deposit')(e.target.value)} /></Field>
                <Field label="Start date *"><input className="input" type="date" value={f.start} onChange={(e) => set('start')(e.target.value)} /></Field>
                <Field label="End date"><input className="input" type="date" value={f.end} onChange={(e) => set('end')(e.target.value)} /></Field>
              </div>

              {Array.isArray(ex.flaggedClauses) && ex.flaggedClauses.length > 0 && (
                <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink"><AlertTriangle size={14} /> Flagged clauses to check</div>
                  <ul className="list-disc pl-5 text-sm text-ink/80">{ex.flaggedClauses.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              <Button className="mt-5 w-full" onClick={confirm} loading={busy} disabled={!canConfirm}>Confirm &amp; create tenant</Button>
              <p className="mt-2 text-center text-xs text-muted">Creates the tenant + lease on the selected unit, raises the first invoice, and sends the lease to sign.</p>
            </GlassCard>
          </div>
        </>
      )}

      {!rec && !parsing && (
        <div className="mt-4"><EmptyState>Tip: works best with digital (text) PDFs. Scanned images need OCR (coming later).</EmptyState></div>
      )}
    </div>
  );
}
