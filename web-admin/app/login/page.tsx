'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth, isOwner } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';
import { Button, Field } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const b = useBrand();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setErr(''); setBusy(true);
    try { await api.requestOtp(destination.trim()); setStage('verify'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const { accessToken } = await api.verifyOtp(destination.trim(), code.trim());
      auth.set(accessToken); router.replace(isOwner() ? '/portal' : '/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <div className="mb-6 flex items-center gap-3">
          {b.logo.imageUrl ? (
            <img src={b.logo.imageUrl} alt="" className="h-12 w-12 rounded-2xl object-contain" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-2xl font-heading text-xl font-bold text-onbrand shadow-soft"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand) 88%, white), var(--brand))' }}>
              {b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
            </span>
          )}
          <div>
            <div className="font-heading text-xl font-bold text-ink">{b.logo.text}</div>
            <div className="text-sm text-muted">{b.tagline ?? 'Back-office'}</div>
          </div>
        </div>

        {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

        {stage === 'request' ? (
          <div className="space-y-4">
            <Field label="Email or mobile number">
              <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="you@example.com or +27…" />
            </Field>
            <p className="-mt-2 text-xs text-muted">We’ll send a one-time code to your email or by SMS. Use the international format for phone numbers (e.g. +27…).</p>
            <Button className="w-full" onClick={request} loading={busy} disabled={!destination.trim()}>Send code</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="6-digit code (sent to your email or phone)">
              <input className="input tracking-[0.4em] text-center text-lg" value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button className="w-full" onClick={verify} loading={busy}>Verify &amp; sign in</Button>
            <button className="w-full text-center text-sm text-muted hover:text-brand" onClick={() => setStage('request')}>Use a different address</button>
          </div>
        )}
      </div>
    </div>
  );
}
