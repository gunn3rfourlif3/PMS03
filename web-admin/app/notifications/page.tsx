'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, Bell as BellIcon } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Badge, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

/**
 * Template names are arbitrary API codes (`rent_due_reminder`, …) with no fixed
 * list this page can see, so there is nothing to key against: they keep the
 * best-effort prettifier. That means a template name stays English in every
 * locale — the one untranslated string on this page, and flagged in the log
 * rather than papered over with a guessed key set.
 */
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const CHANNELS = ['email', 'sms', 'push'] as const;
const channelLabel = (t: TFunction, c: string): string =>
  (CHANNELS as readonly string[]).includes(c) ? t(`notifications.channel.${c}` as MessageKey) : c;

const STATUSES = ['queued', 'sent', 'delivered', 'failed'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`notifications.status.${st}` as MessageKey) : st;
const channelIcon = (c: string) => c === 'email' ? <Mail size={16} /> : c === 'sms' ? <MessageSquare size={16} /> : <BellIcon size={16} />;
const tone = (s: string): 'success' | 'danger' | 'muted' | 'brand' =>
  s === 'delivered' ? 'success' : s === 'failed' ? 'danger' : s === 'queued' ? 'muted' : 'brand';

export default function NotificationsPage() {
  const router = useRouter();
  const { t, dateTime } = useLocale();
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
      <PageHeader title={t('notifications.title')} subtitle={t('notifications.subtitle')} />
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
                <div className="truncate text-sm text-muted">{channelLabel(t, n.channel)} · {n.destination}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={tone(n.status)}>{statusLabel(t, n.status)}</Badge>
                {/* Was `toLocaleString()` with no locale — browser language,
                    not the app's. */}
                <span className="text-xs text-muted">{n.createdAt ? dateTime(n.createdAt) : ''}</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && <EmptyState>{t('notifications.empty')}</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
