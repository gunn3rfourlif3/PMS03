'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, Bell as BellIcon } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Badge, EmptyState } from '@/components/ui';

const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const channelIcon = (c: string) => c === 'email' ? <Mail size={16} /> : c === 'sms' ? <MessageSquare size={16} /> : <BellIcon size={16} />;
const tone = (s: string): 'success' | 'danger' | 'muted' | 'brand' =>
  s === 'delivered' ? 'success' : s === 'failed' ? 'danger' : s === 'queued' ? 'muted' : 'brand';

export default function NotificationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    api.listNotifications().then(setRows).catch((e) => setErr(e.message));
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Delivery activity across your vendor" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="divide-y divide-line">
          {rows.map((n) => (
            <div key={n.id} className="flex items-center gap-3 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}>
                {channelIcon(n.channel)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{humanize(n.template)}</div>
                <div className="truncate text-sm text-muted">{n.channel} · {n.destination}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={tone(n.status)}>{n.status}</Badge>
                <span className="text-xs text-muted">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && <EmptyState>No notifications yet.</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
