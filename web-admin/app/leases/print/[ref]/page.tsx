'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ExternalLink, Upload } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge } from '@/components/ui';

/**
 * Print and sign — the mode A signature path.
 *
 * Staff-facing and internal. In a sealed installation there is no published
 * address, so nothing a tenant can click exists: the lease is printed, signed by
 * hand, and the countersigned scan goes back against the lease.
 *
 * `lease-agreement.service.ts` points a new agreement here instead of at
 * `/sign/<ref>` when the deployment mode serves no e-signature.
 *
 * The lease document itself is already rendered and stored — this page does not
 * re-render it. It opens that document for printing and carries the signature
 * block to print alongside it, so what gets signed is the stored document and
 * not a second rendering that might differ from it.
 */
export default function LeasePrintPage() {
  const { ref } = useParams<{ ref: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [agreement, setAgreement] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.getLeaseToSign(String(ref))
      .then(setAgreement)
      .catch((e: any) => setErr(e.message));
  }, [ref]);

  if (!ready) return null;

  const signed = agreement?.status === 'signed';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Print and sign"
        subtitle="This installation does not serve e-signature. The lease is printed, signed by hand, and the countersigned scan is uploaded back."
      />

      {err && <GlassCard className="border-danger/40 p-3 text-sm text-danger">{err}</GlassCard>}

      {agreement && (
        <>
          <GlassCard className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Agreement</p>
                <p className="font-mono text-sm text-ink">{String(ref)}</p>
              </div>
              <Badge tone={signed ? 'success' : 'brand'}>{agreement.status}</Badge>
            </div>

            {signed && agreement.signerName && (
              <p className="text-sm text-muted">
                Already signed by {agreement.signerName}
                {agreement.signedAt ? ` on ${String(agreement.signedAt).slice(0, 10)}` : ''}.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={agreement.fileUrl} target="_blank" rel="noreferrer">
                <Button><ExternalLink size={16} /> Open the lease</Button>
              </a>
              <Button variant="ghost" onClick={() => window.print()}>
                <Printer size={16} /> Print this signature page
              </Button>
            </div>
            <p className="text-xs text-muted">
              Open the lease and print it, then print this page as the signature sheet. The document is the one
              already stored against this lease — nothing is re-rendered here, so what is signed is what the
              system holds.
            </p>
          </GlassCard>

          <GlassCard className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-ink">What happens next</h2>
            <ol className="space-y-2 text-sm text-ink">
              <li>1. Print the lease and this signature sheet.</li>
              <li>2. The tenant signs both copies by hand; a staff member witnesses and countersigns.</li>
              <li>3. Scan the signed pages and upload them against this lease.</li>
            </ol>
            <a href={`/documents?lease=${encodeURIComponent(String(ref))}`}>
              <Button variant="ghost"><Upload size={16} /> Upload the signed scan</Button>
            </a>
          </GlassCard>

          {/* The signature block. Plain and printable: no glass, no colour. */}
          <div className="signature-sheet rounded-2xl border border-line p-6">
            <h2 className="text-sm font-semibold text-ink">Signatures</h2>
            <p className="mt-1 text-xs text-muted">Agreement {String(ref)}</p>

            {[
              { who: 'Tenant', extra: 'Full name as per ID' },
              { who: 'For the agency', extra: 'Name and capacity' },
              { who: 'Witness', extra: 'Full name' },
            ].map((row) => (
              <div key={row.who} className="mt-8">
                <p className="text-xs uppercase tracking-wide text-muted">{row.who}</p>
                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  <div className="border-b border-ink/40 pb-1 text-[11px] text-muted">Signature</div>
                  <div className="border-b border-ink/40 pb-1 text-[11px] text-muted">{row.extra}</div>
                  <div className="border-b border-ink/40 pb-1 text-[11px] text-muted">Date</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Print only the signature sheet: the lease prints from its own document. */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .signature-sheet, .signature-sheet * { visibility: visible; }
          .signature-sheet { position: absolute; inset: 0; border: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}
