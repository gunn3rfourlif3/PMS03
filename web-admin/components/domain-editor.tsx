'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Check, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Badge } from '@/components/ui';

const DEFAULT_IP = '169.58.46.223';
const TTL = 3600;

/**
 * One DNS row, in the two spellings registrars ask for. Some panels want the
 * label (`www`), some want the whole hostname (`www.agency.co.za`), and getting
 * it wrong usually creates `www.agency.co.za.agency.co.za` silently.
 */
interface Row { label: string; host: string }

function rowsFor(domain: string, hosts: string[]): Row[] {
  return hosts.map((h) => ({
    label: h === domain ? '@' : h.slice(0, -(domain.length + 1)),
    host: h,
  }));
}

/** A fixed-width block the operator can paste into a ticket or an email. */
function asBlock(rows: Row[], ip: string, useFqdn: boolean): string {
  const names = rows.map((r) => (useFqdn ? r.host : r.label));
  const w = Math.max(...names.map((n) => n.length));
  return rows
    .map((r, i) => `A    ${names[i].padEnd(w)}    ${TTL}    ${ip}`)
    .join('\n');
}

/**
 * Set an agency's custom domain, and hand over the DNS records that make it
 * work. This used to be a raw SQL statement in the runbook — the last step of
 * stage 2 that needed a database prompt.
 */
export default function DomainEditor({ vendorId }: { vendorId: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [ip, setIp] = useState(DEFAULT_IP);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [fqdn, setFqdn] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.agencyDomain(vendorId);
      setCurrent(d.customDomain ?? null);
      setHosts(d.hosts ?? []);
      setIp(d.ip || DEFAULT_IP);
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
      setIp(d.ip || DEFAULT_IP);
      setValue(d.customDomain ?? '');
      setOk(d.cleared ? 'Domain removed.'
        : d.normalised ? `Saved as ${d.customDomain} — the bare domain is what the certificate check matches.`
          : 'Saved.');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const rows = useMemo(
    () => (current ? rowsFor(current, hosts) : []),
    [current, hosts],
  );

  /**
   * Clipboard writes fail on an insecure origin and when the document is not
   * focused, and a silently-empty clipboard is worse than none — so fall back
   * to a hidden textarea and say so if even that fails.
   */
  const copy = async (text: string, what: string) => {
    const done = () => { setCopied(what); setTimeout(() => setCopied(''), 1800); };
    try {
      await navigator.clipboard.writeText(text);
      done();
      return;
    } catch { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      setErr('Could not reach the clipboard — select the records and copy them by hand.');
    }
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

      {current && rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              DNS records to create ({rows.length})
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFqdn(false)}
                  className={`rounded-md px-2 py-1 ${!fqdn ? 'bg-brand text-white' : 'text-muted'}`}
                >
                  Labels
                </button>
                <button
                  type="button"
                  onClick={() => setFqdn(true)}
                  className={`rounded-md px-2 py-1 ${fqdn ? 'bg-brand text-white' : 'text-muted'}`}
                >
                  Full hostnames
                </button>
              </div>
              <Button variant="ghost" onClick={() => copy(asBlock(rows, ip, fqdn), 'records')}>
                {copied === 'records' ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy all</>}
              </Button>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-4 font-medium">Type</th>
                  <th className="py-1 pr-4 font-medium">Host</th>
                  <th className="py-1 pr-4 font-medium">TTL</th>
                  <th className="py-1 pr-4 font-medium">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody className="font-mono text-ink">
                {rows.map((r) => {
                  const name = fqdn ? r.host : r.label;
                  return (
                    <tr key={r.host} className="border-t border-line">
                      <td className="py-1.5 pr-4">A</td>
                      <td className="py-1.5 pr-4">{name}</td>
                      <td className="py-1.5 pr-4 text-muted">{TTL}</td>
                      <td className="py-1.5 pr-4">{ip}</td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          title={`Copy ${name}`}
                          onClick={() => copy(name, r.host)}
                          className="rounded-md p-1 text-muted hover:text-ink"
                        >
                          {copied === r.host ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            All of them are <span className="text-ink">A</span> records pointing at{' '}
            <span className="text-ink">{ip}</span> — never CNAME, which cannot hold an IP address.
            Switch to <span className="text-ink">Full hostnames</span> if the registrar&apos;s panel
            wants <span className="text-ink">{rows[1]?.host ?? 'www.agency.co.za'}</span> rather
            than <span className="text-ink">{rows[1]?.label ?? 'www'}</span>. Leave MX alone.
          </p>
          <p className="mt-1 text-xs text-muted">
            Certificates issue on the first visit — no restart, no deploy. Create every record
            before anyone browses, or the first attempt fails and Let&apos;s Encrypt backs off.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {hosts.map((h) => (
              <Badge key={h} tone="muted"><Globe size={11} /> {h}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
