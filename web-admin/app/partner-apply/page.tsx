'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';
import { Button, Field } from '@/components/ui';

/**
 * Stage 1 of the partner application: contact details only.
 *
 * Asking for ID numbers, directors and banking on this page deterred applicants,
 * so all vetting moved to /partner-apply/continue, reached via an emailed link.
 * That link also verifies the address before we collect anything sensitive.
 */
export default function PartnerApplyPage() {
  const b = useBrand();
  const [f, setF] = useState<{ contactName?: string; contactEmail?: string; contactPhone?: string }>({});
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await api.startPartnerApplication({
        contactName: f.contactName?.trim(),
        contactEmail: (f.contactEmail ?? '').trim(),
        contactPhone: f.contactPhone?.trim(),
      });
      setSent(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const emailValid = /\S+@\S+\.\S+/.test(f.contactEmail ?? '');

  return (
    <div className="mx-auto max-w-xl p-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        {b.logo.wordmarkUrl
          ? <img src={b.logo.wordmarkUrl} alt={b.name} className="h-8 w-auto" />
          : <span className="font-heading text-xl font-bold text-ink">{b.name}</span>}
      </div>

      {sent ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-2xl">✓</div>
          <h1 className="mt-3 font-heading text-xl font-bold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            We&rsquo;ve sent a link to <span className="font-medium text-ink">{f.contactEmail}</span> to
            complete your application. It only takes a few minutes — you&rsquo;ll need your ID or company
            registration and your banking details.
          </p>
          <p className="mt-4 text-xs text-muted">
            Nothing in your inbox? Check your spam folder, or email us at{' '}
            <a className="text-brand hover:underline" href="mailto:partners@locare.co.za">partners@locare.co.za</a>.
          </p>
        </div>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-bold text-ink">Become a partner</h1>
          <p className="mb-6 mt-1 text-sm text-muted">
            Refer property agencies to {b.name} and earn recurring commission for as long as they stay.
            Start with your contact details — we&rsquo;ll email you a link to finish.
          </p>

          {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

          <div className="glass-strong space-y-4 rounded-3xl p-6">
            <Field label="Your name">
              <input className="input" value={f.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={f.contactEmail ?? ''}
                onChange={(e) => set('contactEmail', e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label="Mobile number">
              <input className="input" value={f.contactPhone ?? ''}
                onChange={(e) => set('contactPhone', e.target.value)} placeholder="+27…" />
            </Field>
            <Button className="w-full" onClick={submit} loading={busy} disabled={!emailValid}>
              Get started
            </Button>
            <p className="text-center text-xs text-muted">
              We&rsquo;ll email you a secure link to complete verification. No documents needed yet.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
