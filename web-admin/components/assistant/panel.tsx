'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, HelpCircle, X } from 'lucide-react';
import { actorFromToken } from '@/lib/api';
import { cn } from '@/lib/cn';
import { contentFor, MANUAL_PATH } from './content';
import { useAssistantSignals } from './use-signals';

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
  // Fetched lazily on first open, capped at three, and empty whenever there is
  // nothing to say — see use-signals.ts for the blocked-upstream guard.
  const signals = useAssistantSignals(open);

  // Which help button opened the panel (desktop strip or mobile pill), so
  // closing can hand focus back to the control the reader actually used.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const openFrom = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = e.currentTarget;
    setOpen(true);
  }, []);

  // Focus moves into the sheet on open and back to the trigger on close. The
  // close button is the first stop rather than the first signal link, so a
  // keyboard reader can dismiss the panel without walking the content.
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
      return;
    }
    openerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      // Trap: the panel is aria-modal, so Tab must not walk the page behind it.
      const sheet = sheetRef.current;
      if (!sheet) return;
      const stops = Array.from(
        sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        // Filtered on markup, not on layout: an `offsetParent` check reads as
        // the obvious "is it visible" test but is zero in any environment that
        // has not computed layout, which silently empties the list and lets
        // Tab walk the page behind an aria-modal dialog.
      ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !sheet.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !sheet.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
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
        onClick={openFrom}
        aria-label="Open help"
        aria-expanded={open}
        className="fixed right-4 top-3 z-20 hidden items-center gap-2 rounded-xl border border-line bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft backdrop-blur transition hover:text-brand lg:flex"
      >
        <HelpCircle size={18} /> Help
      </button>

      <button
        type="button"
        onClick={openFrom}
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
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-up motion-reduce:animate-none"
            onClick={close}
          />
          <aside
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Help"
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-none flex-col lg:max-w-[420px]',
              'border-l border-line bg-white p-5 shadow-soft',
              'animate-fade-up motion-reduce:animate-none',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">{entry.title}</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close help"
                className="grid h-9 w-9 place-items-center rounded-xl text-ink transition hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto text-sm text-muted">
              {signals.length > 0 && (
                <ul className="mb-5 space-y-2">
                  {signals.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        onClick={close}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-black/[0.02] px-3 py-2.5 text-sm text-ink transition hover:border-brand"
                      >
                        <span>{s.text}</span>
                        <ChevronRight size={16} className="flex-none text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

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
