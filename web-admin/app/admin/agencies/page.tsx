'use client';
import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import { GlassCard, Button, Badge, PageHeader, EmptyState } from '@/components/ui';

type Agency = { vendorId: string; name: string; slug: string; status: string };
type Event = { id: string; adminEmail: string; agency: string; reason?: string; startedAt: string; endedAt?: string };

export default function AdminAgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => {
    api.listAgencies().then(setAgencies).catch((e) => { setErr(e.message); setAgencies([]); });
    api.impersonationEvents().then(setEvents).catch(() => {});
  };
  useEffect(load, []);

  const open = async (a: Agency) => {
    const reason = window.prompt(`Open ${a.name}'s back office as support?\n\nOptional reason (for the audit log):`, '');
    if (reason === null) return; // cancelled
    setBusy(a.vendorId); setErr('');
    try {
      const { accessToken } = await api.impersonate(a.vendorId, reason || undefined);
      auth.set(accessToken);
      window.location.href = '/'; // into the agency's dashboard (Locare-branded)
    } catch (e: any) { setErr(e.message); setBusy(''); }
  };

  const fmt = (s?: string) => (s ? new Date(s).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div>
      <PageHeader title="Agencies" subtitle="Every agency on the platform. Open one's back office to provide support." />

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {agencies === null ? (
        <p className="text-muted">Loading…</p>
      ) : agencies.length === 0 ? (
        <EmptyState>No agencies yet.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {agencies.map((a) => (
            <GlassCard key={a.vendorId} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-heading text-lg font-bold text-ink">{a.name}</div>
                <div className="text-sm text-muted">{a.slug}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={a.status === 'active' ? 'success' : 'muted'}>{a.status}</Badge>
                <Button variant="ghost" onClick={() => open(a)} loading={busy === a.vendorId} disabled={a.status !== 'active'}>
                  Open back office →
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 font-heading text-lg font-bold text-ink">Recent support sessions</h2>
      {events.length === 0 ? (
        <EmptyState>No impersonation sessions recorded yet.</EmptyState>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Agency</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Ended</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="px-4 py-3">{e.adminEmail}</td>
                  <td className="px-4 py-3">{e.agency}</td>
                  <td className="px-4 py-3 text-muted">{e.reason || '—'}</td>
                  <td className="px-4 py-3">{fmt(e.startedAt)}</td>
                  <td className="px-4 py-3">{e.endedAt ? fmt(e.endedAt) : <Badge tone="brand">active</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
