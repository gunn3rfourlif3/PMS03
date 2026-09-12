'use client';
import { useCallback, useEffect, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Badge } from '@/components/ui';

/**
 * Set an agency's custom domain. This used to be a raw SQL statement in the
 * runbook — the last step of stage 2 that needed a database prompt.
 */
export default function DomainEditor({ vendorId }: { vendorId: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.agencyDomain(vendorId);
      setCurrent(d.customDomain ?? null);
      setHosts(d.hosts ?? []);
      setValue(d.customDomain ?? '');
    } catch (e: any) { setErr(e.message); }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr(''); setOk('');
    try {
      const d = await api.setAgencyDomain(vendorId, value.trim() || null);
      setCurrent(d.customDomain ?? null);
      setHosts(d.hosts ?? []);
      setValue(d.customDomain ?? '');
      setOk(d.cleared ? 'Domain removed.'
        : d.normalised ? `Saved as ${d.customDomain} — the bare domain is what the certificate check matches.`
          : 'Saved.');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Custom domain
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="agency.co.za"
            spellCheck={false}
            autoCapitalize="off"
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <Button onClick={save} loading={busy}>Save</Button>
      </div>

      <p className="mt-2 text-xs text-muted">
        Their bare domain — <span className="text-ink">agency.co.za</span>, not app.agency.co.za.
        Paste a full URL if that is what you have; it gets trimmed. Clear the field to remove it.
      </p>

      {err && <div className="mt-2 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {ok && (
        <div className="mt-2 rounded-xl px-3 py-2 text-sm text-success"
          style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
          <Check size={13} className="inline" /> {ok}
        </div>
      )}

      {current && hosts.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-muted">
            Point these at <span className="text-ink">169.58.46.223</span>. Certificates issue on the
            first visit — no restart, no deploy.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hosts.map((h) => (
              <Badge key={h} tone="muted"><Globe size={11} /> {h}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
