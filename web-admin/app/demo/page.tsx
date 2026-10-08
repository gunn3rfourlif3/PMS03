import { notFound } from 'next/navigation';
import {
  resolveDeploymentProfile, capabilitiesFor, isOnSite, DEPLOYMENT_LABELS, DeploymentProfile,
} from '@/lib/deployment';

/**
 * The demo console — docs/LOCARE_ONSITE_DEMO_BUILD_PLAN.md Day 7.
 *
 * The page that is on screen while the trade-off is explained. It states what
 * this installation serves and what it does not, and for the two on-site options
 * the four things the client has to supply.
 *
 * ONLY IN THE DEMO STACK. `DEMO_CONSOLE` is set in compose.demo.yml and nowhere
 * else, so this route 404s in production — a page about deployment options has
 * no business in a real agency's back office.
 *
 * NO FIGURE HERE THAT THE OPTIONS NOTE DOES NOT CARRY. The server spec and the
 * four requirements are quoted from LOCARE_ONSITE_CLIENT_OPTIONS.md; there is no
 * price, no rate and no timeline, because none was agreed.
 */
export const dynamic = 'force-dynamic';

const SERVES: { key: keyof ReturnType<typeof capabilitiesFor>; label: string; sealed: string }[] = [
  { key: 'tenantLogins', label: 'Tenant sign-in and tenant app', sealed: 'Not served' },
  { key: 'landlordLogins', label: 'Landlord sign-in and owner portal', sealed: 'Not served' },
  { key: 'publicListings', label: 'Public rental listings', sealed: 'Not served' },
  { key: 'onlineRent', label: 'Card and instant-EFT rent', sealed: 'Bank-statement import instead' },
  { key: 'eSignature', label: 'E-signature of leases', sealed: 'Print and sign instead' },
  { key: 'otpToPhone', label: 'Login codes to a phone', sealed: 'Internal mail only' },
];

/** Quoted from the client note. Both on-site options need all four. */
const MUST_SUPPLY = [
  'A server — 4 cores, 16 GB, 500 GB, Linux, always on.',
  'A way to send email.',
  'Nightly backups kept off that machine, with one restore actually tested.',
  'A named IT person.',
];

const WHERE: Record<DeploymentProfile, { data: string; runBy: string; effort: string }> = {
  onsite_backoffice: { data: 'Their building, sealed off', runBy: 'Their IT', effort: 'Low' },
  onsite_connected: { data: 'Their building, one published address', runBy: 'Their IT', effort: 'High' },
  private_server: { data: 'Our data centre, their own database', runBy: 'Us', effort: 'None' },
};

export default function DemoConsolePage() {
  if (process.env.DEMO_CONSOLE !== '1') notFound();

  const profile = resolveDeploymentProfile(process.env.DEPLOYMENT_PROFILE);
  const caps = capabilitiesFor(profile);
  const where = WHERE[profile];
  const onSite = isOnSite(profile);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <header>
        <p className="text-xs uppercase tracking-wide text-muted">This installation</p>
        <h1 className="text-2xl font-semibold text-ink">{DEPLOYMENT_LABELS[profile]}</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Where the data sits', where.data],
          ['Who runs it', where.runBy],
          ['Their IT effort', where.effort],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-sm font-medium text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          What this installation serves
        </h2>
        <ul>
          {SERVES.map((row) => {
            const on = caps[row.key];
            return (
              <li key={row.key} className="flex items-center justify-between gap-4 border-b border-line/50 px-4 py-3 text-sm last:border-0">
                <span className="text-ink">{row.label}</span>
                <span className={on ? 'font-medium' : 'text-muted'} style={on ? { color: 'var(--brand)' } : undefined}>
                  {on ? 'Served' : row.sealed}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {onSite ? (
        <section className="rounded-2xl border border-line p-4">
          <h2 className="text-sm font-semibold text-ink">What the client supplies</h2>
          <p className="mt-1 text-xs text-muted">
            The machine is in their building, so these four are theirs. If they cannot tick all four, a private server is the better answer.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {MUST_SUPPLY.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-muted">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-2xl border border-line p-4">
          <h2 className="text-sm font-semibold text-ink">What the client supplies</h2>
          <p className="mt-1 text-sm text-ink">
            Nothing. The machine, the backups and the mail path are ours. This is often what a client means by
            “on our own server”, and it answers data separation without an on-site build.
          </p>
        </section>
      )}

      {profile === 'onsite_backoffice' && (
        <section className="rounded-2xl border border-line p-4">
          <h2 className="text-sm font-semibold text-ink">The trade-off, in one line</h2>
          <p className="mt-1 text-sm text-ink">
            Everything their own people do at their desks works with no internet at all. Anything an outsider must
            reach needs one address published to the internet — and that is the whole decision.
          </p>
        </section>
      )}
    </div>
  );
}
