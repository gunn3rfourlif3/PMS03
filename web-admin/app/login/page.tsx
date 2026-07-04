'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';

export default function LoginPage() {
  const router = useRouter();
  const b = useBrand();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('owner@demo.test');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setErr(''); setBusy(true);
    try { await api.requestOtp(destination.trim()); setStage('verify'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const { accessToken } = await api.verifyOtp(destination.trim(), code.trim());
      auth.set(accessToken);
      router.replace('/');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="center">
      <div className="card authcard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          {b.logo.imageUrl
            ? <img src={b.logo.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'contain' }} />
            : <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--brand)', color: 'var(--onbrand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}</span>}
          <div className="h1" style={{ fontSize: 20 }}>{b.logo.text}</div>
        </div>
        <p className="sub">{b.tagline ?? 'Sign in to manage your portfolio'}</p>
        {err && <div className="err">{err}</div>}
        {stage === 'request' ? (
          <>
            <label>Email or phone</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} />
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={request} disabled={busy}>{busy ? 'Sending...' : 'Send code'}</button>
            </div>
          </>
        ) : (
          <>
            <label>6-digit code (from the API server console)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <div style={{ marginTop: 16 }} className="row">
              <button className="btn" onClick={verify} disabled={busy}>{busy ? 'Verifying...' : 'Verify'}</button>
              <button className="btn secondary" onClick={() => setStage('request')}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
