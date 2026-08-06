'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';
import { Button, Field } from '@/components/ui';

type Type = 'individual' | 'business';
type Doc = { key: string; label: string; required: boolean };

const DOCS: Record<Type, Doc[]> = {
  individual: [
    { key: 'id_document', label: 'ID / passport', required: true },
    { key: 'proof_of_address', label: 'Proof of address', required: true },
    { key: 'bank_confirmation', label: 'Bank confirmation letter', required: true },
  ],
  business: [
    { key: 'company_registration', label: 'Company registration (CIPC)', required: true },
    { key: 'bank_confirmation', label: 'Bank confirmation letter', required: true },
    { key: 'director_id', label: "Director's ID", required: false },
    { key: 'vat_certificate', label: 'VAT certificate', required: false },
  ],
};

export default function PartnerApplyPage() {
  const b = useBrand();
  const [step, setStep] = useState(0); // 0 type+contact, 1 details, 2 banking+consent, 3 documents, 4 done
  const [type, setType] = useState<Type>('individual');
  const [f, setF] = useState<any>({ banking: {}, directors: [{ name: '', idNumber: '' }], idType: 'sa_id' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const setBank = (k: string, v: any) => setF((s: any) => ({ ...s, banking: { ...s.banking, [k]: v } }));

  const [appId, setAppId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({}); // docType -> filename
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  // Resume from a request-info link (?id=&token=) — jump straight to documents.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('id'), t = q.get('token');
    if (id && t) { setAppId(id); setToken(t); setStep(3); }
  }, []);

  const docs = DOCS[type];
  const requiredDone = docs.filter((d) => d.required).every((d) => uploaded[d.key]);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  // Create the draft when the applicant reaches the documents step.
  const startDocuments = async () => {
    setErr('');
    if (!f.agreedTerms) { setErr('Please agree to the terms to continue.'); return; }
    setBusy('create');
    try {
      const r = await api.createPartnerApplication({ type, ...f });
      setAppId(r.id); setToken(r.uploadToken); next();
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const upload = async (docKey: string, file?: File) => {
    if (!file || !appId || !token) return;
    setErr(''); setBusy(docKey);
    try { await api.uploadApplicationDoc(appId, token, docKey, file); setUploaded((u) => ({ ...u, [docKey]: file.name })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const submit = async () => {
    if (!appId || !token) return;
    setErr(''); setBusy('submit');
    try { await api.submitPartnerApplication(appId, token); setStep(4); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const steps = ['Your details', 'Verification', 'Banking', 'Documents'];

  return (
    <div className="mx-auto max-w-xl p-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        {b.logo.wordmarkUrl ? <img src={b.logo.wordmarkUrl} alt={b.name} className="h-8 w-auto" /> : <span className="font-heading text-xl font-bold text-ink">{b.name}</span>}
      </div>
      <h1 className="font-heading text-2xl font-bold text-ink">Become a partner</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Apply to join the {b.name} partner programme. We vet every partner (KYC/KYB), so please have your ID/company and banking details ready.</p>

      {step < 4 && (
        <div className="mb-6 flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-black/10'}`} title={s} />
          ))}
        </div>
      )}

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="glass-strong rounded-3xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['individual', 'business'] as Type[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition ${type === t ? 'border-brand bg-brand/5 text-ink' : 'border-line text-muted hover:border-ink'}`}>{t}</button>
              ))}
            </div>
            <Field label="Contact name"><input className="input" value={f.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} /></Field>
            <Field label="Contact email"><input className="input" type="email" value={f.contactEmail ?? ''} onChange={(e) => set('contactEmail', e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Contact phone"><input className="input" value={f.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+27…" /></Field>
            <Button className="w-full" onClick={next} disabled={!f.contactEmail}>Continue</Button>
          </div>
        )}

        {step === 1 && type === 'individual' && (
          <div className="space-y-4">
            <Field label="Full legal name"><input className="input" value={f.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID type">
                <select className="input" value={f.idType ?? 'sa_id'} onChange={(e) => set('idType', e.target.value)}>
                  <option value="sa_id">SA ID</option><option value="passport">Passport</option>
                </select>
              </Field>
              <Field label="ID / passport number"><input className="input" value={f.idNumber ?? ''} onChange={(e) => set('idNumber', e.target.value)} /></Field>
            </div>
            <Field label="Residential address"><input className="input" value={f.residentialAddress ?? ''} onChange={(e) => set('residentialAddress', e.target.value)} /></Field>
            <div className="flex gap-2"><Button variant="ghost" onClick={back}>Back</Button><Button className="flex-1" onClick={next} disabled={!f.fullName || !f.idNumber}>Continue</Button></div>
          </div>
        )}

        {step === 1 && type === 'business' && (
          <div className="space-y-4">
            <Field label="Registered company name"><input className="input" value={f.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration no. (CIPC)"><input className="input" value={f.registrationNumber ?? ''} onChange={(e) => set('registrationNumber', e.target.value)} /></Field>
              <Field label="VAT no. (optional)"><input className="input" value={f.vatNumber ?? ''} onChange={(e) => set('vatNumber', e.target.value)} /></Field>
            </div>
            <Field label="Business address"><input className="input" value={f.businessAddress ?? ''} onChange={(e) => set('businessAddress', e.target.value)} /></Field>
            <Field label="Primary director">
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Name" value={f.directors?.[0]?.name ?? ''} onChange={(e) => set('directors', [{ ...(f.directors?.[0] ?? {}), name: e.target.value }])} />
                <input className="input" placeholder="ID number" value={f.directors?.[0]?.idNumber ?? ''} onChange={(e) => set('directors', [{ ...(f.directors?.[0] ?? {}), idNumber: e.target.value }])} />
              </div>
            </Field>
            <div className="flex gap-2"><Button variant="ghost" onClick={back}>Back</Button><Button className="flex-1" onClick={next} disabled={!f.companyName || !f.registrationNumber}>Continue</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Where should we pay your commission?</p>
            <Field label="Bank"><input className="input" value={f.banking.bankName ?? ''} onChange={(e) => setBank('bankName', e.target.value)} /></Field>
            <Field label="Account holder"><input className="input" value={f.banking.accountHolder ?? ''} onChange={(e) => setBank('accountHolder', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account number"><input className="input" value={f.banking.accountNumber ?? ''} onChange={(e) => setBank('accountNumber', e.target.value)} /></Field>
              <Field label="Branch code"><input className="input" value={f.banking.branchCode ?? ''} onChange={(e) => setBank('branchCode', e.target.value)} /></Field>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={!!f.agreedTerms} onChange={(e) => set('agreedTerms', e.target.checked)} />
              I consent to {b.name} processing my personal/business information for vetting (KYC/KYB) and confirm the details are accurate.
            </label>
            <div className="flex gap-2"><Button variant="ghost" onClick={back}>Back</Button><Button className="flex-1" onClick={startDocuments} loading={busy === 'create'} disabled={!f.banking.accountNumber || !f.banking.bankName || !f.agreedTerms}>Continue</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Upload your supporting documents (PDF or image).</p>
            {docs.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <div className="text-sm">
                  <div className="font-medium text-ink">{d.label}{d.required && <span className="text-danger"> *</span>}</div>
                  {uploaded[d.key] && <div className="text-xs text-muted">✓ {uploaded[d.key]}</div>}
                </div>
                <label className="cursor-pointer rounded-lg bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-black/10">
                  {busy === d.key ? 'Uploading…' : uploaded[d.key] ? 'Replace' : 'Upload'}
                  <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => upload(d.key, e.target.files?.[0])} />
                </label>
              </div>
            ))}
            <Button className="w-full" onClick={submit} loading={busy === 'submit'} disabled={!requiredDone}>Submit application</Button>
            {!requiredDone && <p className="text-center text-xs text-muted">Upload the required (*) documents to submit.</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-2xl">✓</div>
            <h2 className="font-heading text-xl font-bold text-ink">Application submitted</h2>
            <p className="text-sm text-muted">Thanks — our team will review your application and email {f.contactEmail ?? 'you'} with the outcome. Once approved, you'll sign in with that email to access your partner portal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
