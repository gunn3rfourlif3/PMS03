'use client';
import { useEffect, useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { GlassCard, PageHeader, Badge, EmptyState } from '@/components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

type Column = { label: string; required: boolean; note: string | null };
type Template = {
  entity: string; label: string; rowIs: string; postsToLedger: boolean;
  columns: Column[]; xlsx: string; csv: string;
};

/** Templates are public, so this page needs no token — and neither does an agency. */
export default function ImportTemplatesPage() {
  const [rows, setRows] = useState<Template[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/imports/templates`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setRows)
      .catch((e) => { setErr(e.message); setRows([]); });
  }, []);

  const url = (path: string) => `${API_BASE.replace(/\/api$/, '')}${path}`;

  return (
    <div>
      <PageHeader
        title="Import templates"
        subtitle="Send these to an agency before the data migration starts"
      />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="mb-4">
        <p className="text-sm text-muted">
          Fill these in and upload them in dependency order — owners, then properties, then units,
          then tenants, then leases. Each file is checked before anything is written, and a corrected
          file can be uploaded again as often as needed.
          {' '}These links need no login, so they can go straight into an email.
        </p>
      </GlassCard>

      {rows === null ? <EmptyState>Loading…</EmptyState> : rows.length === 0 ? (
        <EmptyState>Could not load the template list.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((t, i) => (
            <GlassCard key={t.entity}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-bold"
                      style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--ink)' }}>
                      {i + 1}
                    </span>
                    <span className="font-heading text-base font-bold text-ink">{t.label}</span>
                    {t.postsToLedger && (
                      <Badge tone="danger">
                        <AlertTriangle size={12} /> moves money
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    One row is {t.rowIs} · {t.columns.length} columns,{' '}
                    {t.columns.filter((c) => c.required).length} required
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <a className="btn btn-primary" href={url(t.xlsx)}><Download size={15} /> Excel</a>
                  <a className="btn btn-ghost" href={url(t.csv)}>CSV</a>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {t.columns.map((c) => (
                  <span key={c.label}>{c.label}{c.required && <span className="text-danger"> *</span>}</span>
                ))}
              </div>

              {t.postsToLedger && (
                <p className="mt-3 rounded-xl px-3 py-2 text-sm text-ink"
                  style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)' }}>
                  Importing this file writes to the accounting ledger, which cannot be edited
                  afterwards — only reversed. The figures are shown for the principal&rsquo;s sign-off
                  before anything is posted.
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
