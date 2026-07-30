'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export default function SignupPage() {
  const [ref, setRef] = useState('');
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const [form, setForm] = useState({ agencyName: '', ownerName: '', ownerEmail: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref') ?? '';
    setRef(code);
    if (!code) { setRefValid(false); return; }
    api.validateRef(code).then((r) => { setRefValid(r.valid); setPartnerName(r.partnerName ?? null); }).catch(() => setRefValid(false));
  }, []);

  const submit = async () => {
    if (!form.agencyName.trim() || !form.ownerEmail.trim()) return;
    setBusy(true); setErr('');
    try { await api.publicSignup({ ref, ...form }); setDone(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-7 shadow-soft">
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto text-success" />
            <h1 className="mt-3 font-heading text-2xl font-bold text-ink">You're all set</h1>
            <p className="mt-2 text-sm text-muted">Your agency has been created. Sign in with <b className="text-ink">{form.ownerEmail}</b> to get started — a one-time code will be emailed to you.</p>
            <a href="/login" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-onbrand">Go to sign in</a>
          </div>
        ) : refValid === false ? (
          <div className="text-center">
            <h1 className="font-heading text-xl font-bold text-ink">Invalid referral link</h1>
            <p className="mt-2 text-sm text-muted">This signup link isn't valid or has expired. Please ask your partner for a current link.</p>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2 text-brand"><Sparkles size={18} /><span className="text-sm font-semibold">Start your agency</span></div>
            <h1 className="font-heading text-2xl font-bold text-ink">Create your account</h1>
            <p className="mt-1 text-sm text-muted">{partnerName ? `Referred by ${partnerName}. ` : ''}Free for up to 10 units — no card needed.</p>
            {err && <div className="mt-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
            <div className="mt-5 grid gap-3">
              <label className="block"><span className="field-label">Agency name</span><input className="input" value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} placeholder="Acme Rentals" /></label>
              <label className="block"><span className="field-label">Your name</span><input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Jane Doe" /></label>
              <label className="block"><span className="field-label">Email</span><input className="input" type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="jane@acme.co.za" /></label>
              <button onClick={submit} disabled={busy || !form.agencyName.trim() || !form.ownerEmail.trim()}
                className="mt-1 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-onbrand disabled:opacity-50">
                {busy ? 'Creating…' : 'Create agency'}
              </button>
              <p className="text-center text-xs text-muted">Your account is activated after a quick review.</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
