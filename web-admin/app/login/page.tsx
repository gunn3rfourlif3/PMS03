'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth, device, homeForRole } from '@/lib/api';
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
  const [googleOn, setGoogleOn] = useState(false);
  const [remember, setRemember] = useState(true);
  // Only show the "resuming" screen when there's actually a device token to try.
  const [resuming, setResuming] = useState(() => (typeof window !== 'undefined' ? !!device.get() : false));

  // Silent re-auth: if this device is remembered, exchange the device token for a
  // session and skip the OTP entirely.
  useEffect(() => {
    api.deviceLogin()
      .then((r) => { if (r?.accessToken) { auth.set(r.accessToken); router.replace(homeForRole()); } else setResuming(false); })
      .catch(() => setResuming(false));
  }, [router]);

  useEffect(() => { api.googleEnabled().then((r) => setGoogleOn(!!r.enabled)).catch(() => {}); }, []);
  const google = () => { window.location.href = api.googleStartUrl(window.location.origin); };

  const request = async () => {
    setErr(''); setBusy(true);
    try { await api.requestOtp(destination.trim()); setStage('verify'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const { accessToken } = await api.verifyOtp(destination.trim(), code.trim(), remember);
      auth.set(accessToken); router.replace(homeForRole());
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (resuming) {
    return <div className="grid min-h-screen place-items-center p-4"><div className="text-sm text-muted">Signing you in…</div></div>;
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 animate-fade-up">
        <div className="mb-6">
          {b.logo.wordmarkUrl ? (
            <>
              <img src={b.logo.wordmarkUrl} alt={b.name} className="h-9 w-auto" />
              <div className="mt-2 text-sm text-muted">{b.tagline ?? 'Back-office'}</div>
            </>
          ) : (
            <div className="flex items-center gap-3">
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
          )}
        </div>

        {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

        {stage === 'request' ? (
          <div className="space-y-4">
            <Field label="Email or mobile number">
              <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="you@example.com or +27…" />
            </Field>
            <p className="-mt-2 text-xs text-muted">We’ll send a one-time code to your email or by SMS. Use the international format for phone numbers (e.g. +27…).</p>
            <Button className="w-full" onClick={request} loading={busy} disabled={!destination.trim()}>Send code</Button>

            {googleOn && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs text-muted">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
                <button type="button" onClick={google}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-card py-2.5 text-sm font-medium text-ink transition hover:border-ink">
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </button>
                <p className="text-center text-xs leading-relaxed text-muted">
                  By continuing with Google you agree to share your name and email with {b.name}
                  {b.contact?.website ? (
                    <> and to our <a href={`https://${b.contact.website}/privacy`} className="text-brand hover:underline">privacy policy</a></>
                  ) : null}.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="6-digit code (sent to your email or phone)">
              <input className="input tracking-[0.4em] text-center text-lg" value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember this device (skip the code next time)
            </label>
            <Button className="w-full" onClick={verify} loading={busy}>Verify &amp; sign in</Button>
            <button className="w-full text-center text-sm text-muted hover:text-brand" onClick={() => setStage('request')}>Use a different address</button>
          </div>
        )}
      </div>
    </div>
  );
}
