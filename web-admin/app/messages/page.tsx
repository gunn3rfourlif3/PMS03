'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle2, RotateCcw, Inbox, ChevronLeft } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Badge, Button, EmptyState } from '@/components/ui';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const initials = (name?: string) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadInbox = () => api.messageInbox().then(setRows).catch((e) => setErr(e.message));

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    loadInbox();
  }, []);

  const open = async (id: string) => {
    setActiveId(id);
    setThread(null);
    try {
      const t = await api.messageThread(id);
      setThread(t);
      loadInbox(); // clears the unread dot now that staff has read it
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) { setErr(e.message); }
  };

  const back = () => { setActiveId(null); setThread(null); };

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    setBusy(true);
    try {
      await api.messageReply(activeId, draft.trim());
      setDraft('');
      const t = await api.messageThread(activeId);
      setThread(t);
      loadInbox();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const toggleStatus = async () => {
    if (!thread) return;
    const next = thread.conversation.status === 'closed' ? 'open' : 'closed';
    await api.messageSetStatus(thread.conversation.id, next);
    const t = await api.messageThread(thread.conversation.id);
    setThread(t);
    loadInbox();
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Messages" subtitle="Conversations with your tenants" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Inbox list — hidden on mobile while a thread is open */}
        <GlassCard className={'!p-0 overflow-hidden ' + (activeId ? 'hidden lg:block' : '')}>
          <div className="max-h-[70vh] divide-y divide-white/40 overflow-y-auto">
            {rows.map((c) => (
              <button key={c.id} onClick={() => open(c.id)}
                className={'flex w-full items-start gap-3 px-4 py-3.5 text-left transition ' + (activeId === c.id ? 'bg-white/60' : 'hover:bg-white/40')}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
                  style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--brand)' }}>
                  {initials(c.tenantName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{c.tenantName || 'Tenant'}</span>
                    <span className="shrink-0 text-[11px] text-muted">{when(c.lastMessageAt)}</span>
                  </div>
                  <div className="truncate text-[13px] font-medium text-ink/80">{c.subject}</div>
                  <div className="truncate text-xs text-muted">{c.lastMessagePreview}</div>
                </div>
                <span className="mt-1 flex shrink-0 flex-col items-end gap-1">
                  {c.unread && <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand)' }} />}
                  {c.status === 'closed' && <span className="text-[10px] uppercase tracking-wide text-muted">closed</span>}
                </span>
              </button>
            ))}
            {rows.length === 0 && <EmptyState>No conversations yet.</EmptyState>}
          </div>
        </GlassCard>

        {/* Thread — on mobile, shown only when a conversation is open */}
        <GlassCard className={'!p-0 overflow-hidden ' + (activeId ? '' : 'hidden lg:block')}>
          {!thread ? (
            <div className="hidden h-[70vh] place-items-center text-muted lg:grid">
              <div className="flex flex-col items-center gap-2">
                <Inbox size={30} className="opacity-40" />
                <span className="text-sm">Select a conversation</span>
              </div>
            </div>
          ) : (
            <div className="flex h-[70vh] flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-white/40 px-4 py-3.5 sm:px-5">
                <button onClick={back}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/50 hover:text-ink lg:hidden"
                  aria-label="Back to inbox"><ChevronLeft size={20} /></button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{thread.conversation.subject}</div>
                  <div className="text-xs text-muted">
                    {rows.find((r) => r.id === thread.conversation.id)?.tenantName || 'Tenant'}
                    {' · '}<Badge tone={thread.conversation.status === 'closed' ? 'muted' : 'success'}>{thread.conversation.status}</Badge>
                  </div>
                </div>
                <Button variant="ghost" onClick={toggleStatus} className="!py-1.5 text-sm">
                  {thread.conversation.status === 'closed' ? <><RotateCcw size={15} /> Reopen</> : <><CheckCircle2 size={15} /> Close</>}
                </Button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {thread.messages.map((m) => {
                  const staff = m.senderRole === 'staff';
                  return (
                    <div key={m.id} className={'flex ' + (staff ? 'justify-end' : 'justify-start')}>
                      <div className={'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ' + (staff ? 'text-white' : 'bg-white/70 text-ink')}
                        style={staff ? { background: 'var(--brand)' } : {}}>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className={'mt-1 text-[10px] ' + (staff ? 'text-white/70' : 'text-muted')}>{when(m.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="flex items-end gap-2 border-t border-white/40 px-4 py-3">
                <textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1} placeholder="Type a reply…"
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-white/50 bg-white/60 px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-[var(--brand)]"
                />
                <Button onClick={send} loading={busy} disabled={!draft.trim()} className="!py-2.5"><Send size={16} /> Send</Button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
