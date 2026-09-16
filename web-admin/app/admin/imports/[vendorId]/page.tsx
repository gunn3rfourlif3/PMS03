'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, CheckCircle2, AlertTriangle, XCircle, Trash2, ArrowRight, FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, EmptyState } from '@/components/ui';

/**
 * The operator's import workspace for one agency (R-5, stage 5 of the runbook).
 *
 * Upload, map the agency's columns onto Locare's fields, check, commit. The
 * check is the point of the whole feature — it turns silent errors into a list
 * with row numbers — so it gets the room, and the commit button stays out of
 * reach until it has been run.
 */

type Field = { key: string; label: string; required: boolean; note?: string | null };
type Spec = { entity: string; label: string; rowIs: string; postsToLedger: boolean; fields: Field[] };
type Batch = {
  id: string; entity: string; label: string; status: string; filename: string;
  sheetName?: string | null; rowCount: number; createdAt: string; committedAt?: string | null;
};

const ORDER = ['owners', 'properties', 'units', 'tenants', 'leases', 'deposits', 'opening_balances'];

export default function ImportWorkspace() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [entity, setEntity] = useState('owners');
  const [active, setActive] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const spec = specs.find((s) => s.entity === (active?.entity ?? entity));

  const refresh = useCallback(() => {
    api.importsList(vendorId).then(setBatches).catch((e) => { setErr(e.message); setBatches([]); });
  }, [vendorId]);

  useEffect(() => {
    api.importCatalogue().then((c: any) => setSpecs(c.entities ?? c)).catch((e) => setErr(e.message));
    refresh();
  }, [refresh]);

  const reset = () => { setActive(null); setReport(null); setErr(''); };

  const upload = async (file: File) => {
    setBusy('upload'); setErr(''); setDone('');
    try {
      const b = await api.importUpload(vendorId, entity, file);
      setActive(b); setReport(null); refresh();
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const chooseSheet = async (name: string) => {
    setBusy('sheet'); setErr('');
    try { setActive(await api.importChooseSheet(vendorId, active.id, name)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const setMapping = async (colIndex: string, fieldKey: string) => {
    const next = { ...(active.mapping ?? {}) };
    if (fieldKey) next[colIndex] = fieldKey; else delete next[colIndex];
    setBusy('map'); setErr('');
    try { setActive(await api.importSetMapping(vendorId, active.id, next)); setReport(null); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const check = async () => {
    setBusy('check'); setErr(''); setDone('');
    try { setReport(await api.importCheck(vendorId, active.id)); refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const commit = async () => {
    const blocked = report?.blocked ?? 0;
    if (blocked > 0 && !window.confirm(
      `${blocked} row${blocked === 1 ? '' : 's'} cannot be imported and will be left out.\n\n`
      + 'Import the other rows anyway?',
    )) return;
    setBusy('commit'); setErr('');
    try {
      const r = await api.importCommit(vendorId, active.id, blocked > 0);
      setDone(`${r.label}: ${r.created} created, ${r.updated} updated${r.skipped ? `, ${r.skipped} left out` : ''}.`);
      reset(); refresh();
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const discard = async (id: string) => {
    if (!window.confirm('Discard this import? The uploaded file is destroyed.')) return;
    setBusy(id);
    try { await api.importDiscard(vendorId, id); if (active?.id === id) reset(); refresh(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const mapped = new Set(Object.values(active?.mapping ?? {}));
  const missing = (spec?.fields ?? []).filter((f) => f.required && !mapped.has(f.key));

  return (
    <div>
      <PageHeader
        title="Import data"
        subtitle="Upload the agency's spreadsheets in order. Nothing is written until you commit."
      />

      <div className="mb-4">
        <Link href="/admin/imports" className="text-sm text-muted underline-offset-2 hover:underline">
          ← Blank templates to send the agency
        </Link>
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {done && (
        <div className="mb-4 rounded-xl px-3 py-2 text-sm text-success"
          style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
          <CheckCircle2 size={14} className="inline" /> {done}
        </div>
      )}

      {/* ── 1. Upload ─────────────────────────────────────────────────── */}
      {!active && (
        <GlassCard className="mb-4">
          <div className="mb-3 font-heading text-base font-bold text-ink">Upload a file</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">What is in it</span>
              <select
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink"
                value={entity} onChange={(e) => setEntity(e.target.value)}
              >
                {ORDER.filter((e) => specs.some((s) => s.entity === e)).map((e) => {
                  const s = specs.find((x) => x.entity === e)!;
                  return <option key={e} value={e}>{s.label} — one row is {s.rowIs}</option>;
                })}
              </select>
            </label>
            <label className="btn btn-primary cursor-pointer">
              <Upload size={15} /> Choose file
              <input
                type="file" hidden accept=".csv,.xlsx,.xls"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            Excel or CSV, in dependency order: owners, properties, units, tenants, leases.
            Deposits and opening balances post to the ledger and are not committed from here yet.
          </p>
        </GlassCard>
      )}

      {/* ── 2. Sheet + mapping ────────────────────────────────────────── */}
      {active && (
        <GlassCard className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-heading text-base font-bold text-ink">
              <FileSpreadsheet size={17} /> {active.filename}
              <Badge tone="muted">{spec?.label}</Badge>
            </div>
            <Button variant="ghost" onClick={reset}>Start over</Button>
          </div>

          {Array.isArray(active.sheets) && active.sheets.length > 1 && (
            <div className="mb-4">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Sheet</span>
              <div className="flex flex-wrap gap-2">
                {active.sheets.map((s: any) => (
                  <Button
                    key={s.name}
                    variant={s.name === active.sheetName ? 'primary' : 'ghost'}
                    onClick={() => chooseSheet(s.name)}
                    loading={busy === 'sheet'}
                  >
                    {s.name} <span className="opacity-60">({s.rows})</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Match their columns to ours
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4">Their column</th>
                  <th className="py-2 pr-4">First value</th>
                  <th className="py-2">Locare field</th>
                </tr>
              </thead>
              <tbody>
                {(active.headers ?? []).map((h: string, i: number) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-2 pr-4 text-ink">{h || <span className="text-muted">(blank)</span>}</td>
                    <td className="py-2 pr-4 text-muted">
                      {String(active.sample?.[0]?.[i] ?? '') || '—'}
                    </td>
                    <td className="py-2">
                      <select
                        className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
                        value={active.mapping?.[String(i)] ?? ''}
                        onChange={(e) => setMapping(String(i), e.target.value)}
                        disabled={busy === 'map'}
                      >
                        <option value="">— not imported —</option>
                        {(spec?.fields ?? []).map((f) => (
                          <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {missing.length > 0 && (
            <p className="mt-3 text-sm text-danger">
              Still needed: {missing.map((f) => f.label).join(', ')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={check} loading={busy === 'check'} disabled={missing.length > 0}>
              Check the file
            </Button>
            <span className="text-xs text-muted">Writes nothing — run it as often as you like.</span>
          </div>
        </GlassCard>
      )}

      {/* ── 3. The check ──────────────────────────────────────────────── */}
      {active && report && (
        <GlassCard className="mb-4">
          <div className="mb-3 font-heading text-base font-bold text-ink">What this file would do</div>

          {report.blockers?.length > 0 && (
            <div className="mb-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">
              {report.blockers.map((b: string) => <div key={b}>{b}</div>)}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <Count n={report.creates} label="new" tone="success" />
            <Count n={report.updates} label="updated" tone="brand" />
            <Count n={report.blocked} label="cannot import" tone="danger" />
            {report.skippedBlank > 0 && <Count n={report.skippedBlank} label="blank rows" tone="muted" />}
          </div>

          {report.blocked > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Rows to fix ({report.blocked})
              </div>
              <div className="space-y-2">
                {report.rows.filter((r: any) => r.action === 'blocked').slice(0, 25).map((r: any) => (
                  <div key={r.rowNumber} className="rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="font-medium text-ink">Row {r.rowNumber}</span>
                    <span className="text-muted"> · {r.summary}</span>
                    <ul className="mt-1 list-disc pl-5 text-danger">
                      {r.issues.filter((i: any) => i.level === 'error').map((i: any, k: number) => (
                        <li key={k}>{i.label}: {i.message}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {report.blocked > 25 && (
                  <p className="text-sm text-muted">…and {report.blocked - 25} more.</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={commit}
              loading={busy === 'commit'}
              disabled={report.blockers?.length > 0 || (report.creates + report.updates) === 0}
            >
              <ArrowRight size={15} /> Import {report.creates + report.updates} row
              {report.creates + report.updates === 1 ? '' : 's'}
            </Button>
            <span className="text-xs text-muted">
              {report.postsToLedger
                ? 'This file posts to the ledger and cannot be committed here yet.'
                : 'Rows land in the agency’s live portfolio. Re-uploading a corrected file updates rather than duplicates.'}
            </span>
          </div>
        </GlassCard>
      )}

      {/* ── History ───────────────────────────────────────────────────── */}
      <h2 className="mb-3 mt-8 font-heading text-lg font-bold text-ink">Files uploaded</h2>
      {batches === null ? <p className="text-muted">Loading…</p>
        : batches.length === 0 ? <EmptyState>Nothing uploaded for this agency yet.</EmptyState> : (
          <GlassCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Contains</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-line/60">
                    <td className="px-4 py-3 text-ink">{b.filename}</td>
                    <td className="px-4 py-3 text-muted">{b.label}</td>
                    <td className="px-4 py-3 tabular-nums">{b.rowCount || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={b.status === 'committed' ? 'success' : b.status === 'discarded' ? 'muted' : 'brand'}>
                        {b.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status !== 'committed' && b.status !== 'discarded' && (
                        <Button variant="ghost" onClick={() => discard(b.id)} loading={busy === b.id}>
                          <Trash2 size={14} /> Discard
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  const colour = tone === 'success' ? 'var(--success)'
    : tone === 'danger' ? 'var(--danger)'
      : tone === 'brand' ? 'var(--brand)' : 'var(--muted)';
  const Icon = tone === 'danger' ? XCircle : tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-center gap-2">
      {tone !== 'muted' && <Icon size={16} style={{ color: colour }} />}
      <span className="font-heading text-xl font-bold tabular-nums" style={{ color: colour }}>{n}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
