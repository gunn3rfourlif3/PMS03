'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { HelpCircle, X } from 'lucide-react';
import { actorFromToken } from '@/lib/api';
import { cn } from '@/lib/cn';
import { contentFor, MANUAL_PATH } from './content';

/**
 * The route key the panel's content is keyed on. It is the partner pathname
 * with any trailing segment/slash trimmed, so `/partner/pipeline/123` and
 * `/partner/pipeline/` both resolve to `/partner/pipeline`.
 */
export function routeKeyFor(path: string): string {
  if (!path.startsWith('/partner')) return '/partner';
  const [, , section] = path.split('/');
  return section ? `/partner/${section}` : '/partner';
}

/**
 * Slide-over help panel for the partner surface.
 *
 * Closed by default; opened by the help button this component renders itself.
 * Shell mounts it for PARTNER_NAV routes only, so there is no agency, owner or
 * admin surface to guard against here. The trigger sits in the partner header
 * strip (fixed top-right of the content column) rather than in the mobile bar,
 * because the desktop layout has no header element of its own.
 *
 * Content is curated per route in `content.ts`; an unknown route falls back to
 * a generic entry naming the manual, so the panel is never empty.
 */
export default function AssistantPanel() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // A support operator viewing an agency is not the partner, and the panel
  // speaks to the partner in the second person. Hide it entirely rather than
  // show guidance addressed to the wrong reader.
  if (actorFromToken()) return null;

  const routeKey = routeKeyFor(path);
  const entry = contentFor(routeKey);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        aria-expanded={open}
        className="fixed right-4 top-3 z-20 hidden items-center gap-2 rounded-xl border border-line bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft backdrop-blur transition hover:text-brand lg:flex"
      >
        <HelpCircle size={18} /> Help
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-20 grid h-12 w-12 place-items-center rounded-full text-onbrand shadow-soft lg:hidden"
        style={{ background: 'var(--brand)' }}
      >
        <HelpCircle size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-up"
            onClick={close}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Help"
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col',
              'border-l border-line bg-white p-5 shadow-soft',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">{entry.title}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close help"
                className="grid h-9 w-9 place-items-center rounded-xl text-ink transition hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto text-sm text-muted">
              <p>{entry.purpose}</p>

              {entry.questions.length > 0 && (
                <dl className="mt-5 space-y-4">
                  {entry.questions.map((item) => (
                    <div key={item.q}>
                      <dt className="text-sm font-semibold text-ink">{item.q}</dt>
                      <dd className="mt-1">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <p className="mt-6 border-t border-line pt-3 text-xs">
                Full detail is in the Partner Manual, under{' '}
                <span className="font-medium text-ink">{entry.manualSection}</span>{' '}
                <span className="font-mono">
                  ({MANUAL_PATH}
                  {entry.manualAnchor})
                </span>
                .
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
