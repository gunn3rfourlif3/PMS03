'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { GlassCard, Button, Field } from '@/components/ui';
import { PublicHeader, PublicFooter } from '@/components/public-chrome';

export default function SignLeasePage() {
  const { ref } = useParams<{ ref: string }>();
  const [doc, setDoc] = useState<any | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    api.getLeaseToSign(ref)
      .then((d) => { setDoc(d); if (d.status === 'signed') setSigned(true); })
      .catch((e) => setLoadErr(e.message));
  }, [ref]);

  const sign = async () => {
    setBusy(true); setErr('');
    try { await api.signLease(ref, name.trim()); setSigned(true); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-ink">Your lease agreement</h1>
        <p className="mb-5 text-sm text-muted">Please review the agreement below, then sign at the bottom.</p>

        {loadErr && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{loadErr}</div>}

        {doc && (
          <>
            <GlassCard className="!p-2">
              <iframe title="Lease agreement" src={doc.fileUrl} sandbox=""
                className="h-[62vh] w-full rounded-xl border border-white/40 bg-white" />
              <div className="px-2 py-2 text-right">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Open in a new tab</a>
              </div>
            </GlassCard>

            {signed ? (
              <GlassCard className="mt-5 text-center">
                <div className="font-heading text-xl font-bold text-ink">Signed &amp; complete ✓</div>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Thank you{doc.signerName ? `, ${doc.signerName.split(' ')[0]}` : ''} — your lease agreement has been signed and recorded. A copy is on file with your agency.
                </p>
              </GlassCard>
            ) : (
              <GlassCard className="mt-5">
                <div className="font-heading text-lg font-bold text-ink">Sign the agreement</div>
                {err && <div className="my-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
                <div className="mt-3">
                  <Field label="Type your full name to sign *">
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
                  </Field>
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm text-ink/80">
                  <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>I have read and understood this lease agreement, and I agree to be bound by it. I consent to signing electronically (ECTA).</span>
                </label>
                <Button className="mt-5 w-full" onClick={sign} loading={busy} disabled={!agree || name.trim().length < 2}>
                  Sign lease agreement
                </Button>
              </GlassCard>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
