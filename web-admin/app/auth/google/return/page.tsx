'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth, homeForRole } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';

/**
 * Landing target after Google → central callback. Reads the one-time code from
 * the URL, exchanges it for the access token, and routes by role. On error
 * (e.g. an unverified Google email, or a pending-lease account) it shows the
 * message and a link back to sign-in.
 */
export default function GoogleReturnPage() {
  const router = useRouter();
  const b = useBrand();
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const error = p.get('error');
    const otc = p.get('otc');
    if (error) { setErr(error); return; }
    if (!otc) { setErr('Sign-in did not complete. Please try again.'); return; }
    api.exchangeGoogleCode(otc)
      .then(({ accessToken }) => { auth.set(accessToken); router.replace(homeForRole()); })
      .catch((e: any) => setErr(e.message || 'Sign-in failed. Please try again.'));
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center animate-fade-up">
        {err ? (
          <>
            <h1 className="font-heading text-xl font-bold text-ink">Couldn’t sign you in</h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">{err}</p>
            <a href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">Back to sign in</a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-line border-t-brand" />
            <p className="text-sm text-muted">Signing you in to {b.name}…</p>
          </>
        )}
      </div>
    </div>
  );
}
