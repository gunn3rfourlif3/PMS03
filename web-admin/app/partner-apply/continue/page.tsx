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

/**
 * Stage 2 of the partner application — the KYC/KYB detail, reached from the link
 * we emailed after stage 1. The `id` + `token` in the query string authorise the
 * whole flow (load, save, upload, submit) without a login.
 *
 * Every step saves to the server before advancing, so an applicant who wanders
 * off mid-way can reopen the same link and pick up where they left off.
 */
export default function PartnerApplyContinuePage() {
  const b = useBrand();
  const [appId, setAppId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [resent, setResent] = useState(false);

  const [step, setStep] = useState(0); // 0 type, 1 details, 2 banking+consent, 3 documents, 4 done
  const [type, setType] = useState<Type>('individual');
  const [f, setF] = useState<any>({ banking: {}, directors: [{ name: '', idNumber: '' }], idType: 'sa_id' });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const setBank = (k: string, v: any) => setF((s: any) => ({ ...s, banking: { ...s.banking, [k]: v } }));

  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  // Load the saved draft behind the link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('id') ?? '';
    const t = q.get('token') ?? '';
    setAppId(id); setToken(t);
    if (!id || !t) { setLoadErr('This link is incomplete. Please use the link from your email.'); setLoading(false); return; }
    api.resumePartnerApplication(id, t)
      .then((a) => {
        setType((a.type as Type) ?? 'individual');
        setF({
          contactName: a.contactName, contactPhone: a.contactPhone,
          fullName: a.fullName, idType: a.idType ?? 'sa_id', residentialAddress: a.residentialAddress,
          companyName: a.companyName, registrationNumber: a.registrationNumber,
          vatNumber: a.vatNumber, businessAddress: a.businessAddress,
          directors: a.directors?.length ? a.directors : [{ name: '', idNumber: '' }],
          banking: a.banking ?? {},
          agreedTerms: a.agreedTerms,
          contactEmail: a.contactEmail,
        });
        const done: Record<string, string> = {};
        (a.documents ?? []).forEach((d: any) => { done[d.docType] = d.name; });
        setUploaded(done);
        if (a.decisionReason) setNote(a.decisionReason);
      })
      .catch((e: any) => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const docs = DOCS[type];
  const requiredDone = docs.filter((d) => d.required).every((d) => uploaded[d.key]);
  const back = () => setStep((s) => Math.max(0, s - 1));

  /** Persist the current step, then advance. */
  const saveAnd = async (patch: any, go: number) => {
    setErr(''); setBusy('save');
    try { await api.savePartnerApplication(appId, token, patch); setStep(go); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const upload = async (docKey: string, file?: File) => {
    if (!file) return;
    setErr(''); setBusy(docKey);
    try {
      await api.uploadApplicationDoc(appId, token, docKey, file);
      setUploaded((u) => ({ ...u, [docKey]: file.name }));
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const submit = async () => {
    setErr(''); setBusy('submit');
    try { await api.submitPartnerApplication(appId, token); setStep(4); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const resend = async () => {
    try { await api.resendMyPartnerApplication(appId); setResent(true); }
    catch (e: any) { setLoadErr(e.message); }
  };

  const header = (
    <div className="mb-6 flex items-center gap-3">
      {b.logo.wordmarkUrl
        ? <img src={b.logo.wordmarkUrl} alt={b.name} className="h-8 w-auto" />
        : <span className="font-heading text-xl font-bold text-ink">{b.name}</span>}
    </div>
  );

  if (loading) {
    return <div className="mx-auto max-w-xl p-4 py-10">{header}<p className="text-sm text-muted">Loading your application…</p></div>;
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-xl p-4 py-10">
        {header}
        <div className="glass-strong rounded-3xl p-8 text-center">
          <h1 className="font-heading text-xl font-bold text-ink">We couldn&rsquo;t open this application</h1>
          <p className="mt-2 text-sm text-muted">{loadErr}</p>
          {appId && !resent && (
            <Button className="mt-4" variant="ghost" onClick={resend}>Email me a new link</Button>
          )}
          {resent && <p className="mt-4 text-sm text-brand">Done — check your inbox for a fresh link.</p>}
        </div>
      </div>
    );
  }

  const steps = ['You', 'Verification', 'Banking', 'Documents'];

  return (
    <div className="mx-auto max-w-xl p-4 py-10">
      {header}
      <h1 className="font-heading text-2xl font-bold text-ink">Complete your application</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        We vet every partner (KYC/KYB). Have your ID or company registration and banking details ready — it takes a few minutes.
      </p>

      {note && (
        <div className="mb-4 rounded-xl bg-brand/5 px-3 py-2 text-sm text-ink">
          <span className="font-medium">A note from our team:</span> {note}
        </div>
      )}

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
            <p className="text-sm text-muted">Are you applying as an individual or a business?</p>
            <div className="flex gap-2">
              {(['individual', 'business'] as Type[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition ${type === t ? 'border-brand bg-brand/5 text-ink' : 'border-line text-muted hover:border-ink'}`}>{t}</button>
              ))}
            </div>
            <Field label="Contact name"><input className="input" value={f.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} /></Field>
            <Field label="Contact phone"><input className="input" value={f.contactPhone ?? ''} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+27…" /></Field>
            <Button className="w-full" loading={busy === 'save'}
              onClick={() => saveAnd({ type, contactName: f.contactName, contactPhone: f.contactPhone }, 1)}>
              Continue
            </Button>
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button className="flex-1" loading={busy === 'save'} disabled={!f.fullName || !f.idNumber}
                onClick={() => saveAnd({ fullName: f.fullName, idType: f.idType ?? 'sa_id', idNumber: f.idNumber, residentialAddress: f.residentialAddress }, 2)}>
                Continue
              </Button>
            </div>
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
                <input className="input" placeholder="Name" value={f.directors?.[0]?.name ?? ''}
                  onChange={(e) => set('directors', [{ ...(f.directors?.[0] ?? {}), name: e.target.value }])} />
                <input className="input" placeholder="ID number" value={f.directors?.[0]?.idNumber ?? ''}
                  onChange={(e) => set('directors', [{ ...(f.directors?.[0] ?? {}), idNumber: e.target.value }])} />
              </div>
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button className="flex-1" loading={busy === 'save'} disabled={!f.companyName || !f.registrationNumber}
                onClick={() => saveAnd({ companyName: f.companyName, registrationNumber: f.registrationNumber, vatNumber: f.vatNumber, businessAddress: f.businessAddress, directors: f.directors }, 2)}>
                Continue
              </Button>
            </div>
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button className="flex-1" loading={busy === 'save'}
                disabled={!f.banking.accountNumber || !f.banking.bankName || !f.agreedTerms}
                onClick={() => saveAnd({ banking: f.banking, agreedTerms: true }, 3)}>
                Continue
              </Button>
            </div>
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={submit} loading={busy === 'submit'} disabled={!requiredDone}>Submit application</Button>
            </div>
            {!requiredDone && <p className="text-center text-xs text-muted">Upload the required (*) documents to submit.</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-2xl">✓</div>
            <h2 className="font-heading text-xl font-bold text-ink">Application submitted</h2>
            <p className="text-sm text-muted">
              Thanks — our team will review your application and email {f.contactEmail ?? 'you'} with the outcome.
              Once approved, you&rsquo;ll sign in with that email to access your partner portal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
