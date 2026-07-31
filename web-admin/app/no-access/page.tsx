'use client';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { useBrand } from '@/components/brand-provider';
import { Button } from '@/components/ui';

/**
 * Shown after a successful sign-in when the account has no agency membership
 * (empty roles / no vendor context). Prevents the raw "Forbidden resource" /
 * "Failed to fetch" errors a role-less user would otherwise hit on the dashboard.
 */
export default function NoAccessPage() {
  const router = useRouter();
  const b = useBrand();

  const signOut = async () => {
    await api.logout().catch(() => {});
    auth.clear();
    router.replace('/login');
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center animate-fade-up">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-tint text-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 4 6v5c0 4.5 3 7.6 8 9 5-1.4 8-4.5 8-9V6z" />
            <path d="M12 8v4M12 15.5h.01" />
          </svg>
        </div>

        <h1 className="font-heading text-2xl font-bold text-ink">You&rsquo;re signed in — but not linked yet</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          This account isn&rsquo;t connected to an agency on {b.name}. Ask your agency
          administrator to add you, or if you&rsquo;re a tenant, use the link in your
          welcome email once your lease is signed.
        </p>

        {b.contact?.email && (
          <a href={`mailto:${b.contact.email}?subject=Account%20access`} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Contact {b.name}
          </a>
        )}

        <div className="mt-7">
          <Button variant="ghost" onClick={signOut} className="w-full">Sign out &amp; try another address</Button>
        </div>
      </div>
    </div>
  );
}
