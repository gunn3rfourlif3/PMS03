'use client';
import { useState } from 'react';
import { Upload, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState, money } from '@/components/ui';

/**
 * Bank-statement reconciliation.
 *
 * Two steps, and the gap between them is the point: preview reads and matches
 * but writes nothing, and only what a person has looked at gets recorded.
 *
 * The unmatched list is not an error state. A statement always has lines that
 * are not rent, and a reconciliation that matched everything would be the thing
 * to distrust.
 */
const REASONS: Record<string, string> = {
  not_a_credit: 'Not a credit',
  no_candidate: 'No invoice matches',
  ambiguous_amount: 'Two invoices match this amount',
  invoice_already_matched: 'That invoice was already matched by another line',
};

export default function StatementsPage() {
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>(null);
  const [skip, setSkip] = useState<Record<string, boolean>>({});

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr(''); setDone(null); setSkip({});
    try { setPreview(await api.previewStatement(file)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const toRecord = (preview?.matched ?? []).filter((m: any) => !skip[m.lineId]);

  const commit = async () => {
    setBusy(true); setErr('');
    try {
      setDone(await api.commitStatement(
        toRecord.map((m: any) => ({ invoiceId: m.invoiceId, amount: m.amount, reference: m.reference })),
      ));
      setPreview(null);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank statement"
        subtitle="Match a statement against open invoices. Nothing is recorded until you say so."
      />

      {err && <GlassCard className="border-danger/40 p-3 text-sm text-danger">{err}</GlassCard>}

      {done && (
        <GlassCard className="p-4">
          <p className="text-sm text-ink">
            Recorded {done.recorded} payment{done.recorded === 1 ? '' : 's'}.
            {done.failed?.length > 0 && ` ${done.failed.length} could not be recorded.`}
          </p>
          {done.failed?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-danger">
              {done.failed.map((f: any, i: number) => <li key={i}>{f.invoiceId}: {f.reason}</li>)}
            </ul>
          )}
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => upload(e.target.files?.[0])} />
          <span className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-onbrand shadow-soft"
            style={{ background: 'var(--brand)' }}>
            <Upload size={16} /> Choose a statement file
          </span>
          <span className="text-muted">
            {busy ? 'Reading…' : 'CSV or Excel, as your bank exports it.'}
          </span>
        </label>
      </GlassCard>

      {preview && (
        <>
          <GlassCard className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-ink">
                {preview.summary.matched} of {preview.summary.lines} lines matched
                {preview.summary.matchedPct !== null && ` (${preview.summary.matchedPct}%)`}
              </span>
              <span className="text-muted">{money(preview.summary.matchedAmount)} to record</span>
            </div>
            {Object.keys(preview.mapping ?? {}).length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Columns read — {Object.entries(preview.mapping).map(([k, v]) => `${k}: ${v}`).join(', ')}.
                Check the dates below look right before recording: a month-first export read as day-first is the
                one mistake this cannot detect.
              </p>
            )}
            {preview.skipped?.length > 0 && (
              <p className="mt-2 text-xs text-danger">
                {preview.skipped.length} row{preview.skipped.length === 1 ? '' : 's'} could not be read:
                {' '}{preview.skipped.slice(0, 3).map((s: any) => `row ${s.row} (${s.reason})`).join(', ')}
                {preview.skipped.length > 3 ? '…' : ''}
              </p>
            )}
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              Will be recorded
            </h2>
            {preview.matched.length === 0 ? (
              <EmptyState>Nothing matched. Check the column mapping above.</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {preview.matched.map((m: any) => (
                    <tr key={m.lineId} className={`border-b border-line/50 last:border-0 ${skip[m.lineId] ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2">{m.date}</td>
                      <td className="px-4 py-2 text-muted">{m.description || m.reference || '—'}</td>
                      <td className="px-4 py-2">{m.unit ?? '—'} · {m.period}</td>
                      <td className="px-4 py-2">
                        <Badge tone={m.basis === 'reference' ? 'brand' : 'muted'}>
                          {m.basis === 'reference' ? 'by reference' : 'by amount'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{money(m.amount)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" onClick={() => setSkip({ ...skip, [m.lineId]: !skip[m.lineId] })}>
                          {skip[m.lineId] ? 'Include' : 'Skip'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.matched.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <Button onClick={commit} disabled={busy || toRecord.length === 0}>
                  <Check size={16} /> Record {toRecord.length} payment{toRecord.length === 1 ? '' : 's'}
                </Button>
              </div>
            )}
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              <AlertTriangle size={16} /> For you to resolve
            </h2>
            {preview.unmatched.length === 0 ? (
              <EmptyState>Every line matched.</EmptyState>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {preview.unmatched.map((u: any) => (
                    <tr key={u.lineId} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-2">{u.date}</td>
                      <td className="px-4 py-2 text-muted">{u.description || '—'}</td>
                      <td className="px-4 py-2 text-right">{money(u.amount)}</td>
                      <td className="px-4 py-2 text-muted">
                        {REASONS[u.reason] ?? u.reason}
                        {u.candidates?.length > 1 && ` (${u.candidates.length})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="border-t border-line px-4 py-3 text-xs text-muted">
              These are not errors. A statement always carries lines that are not rent, and an ambiguous one is
              reported rather than guessed at — allocating to the nearer of two identical amounts is how money
              lands on the wrong tenant.
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
