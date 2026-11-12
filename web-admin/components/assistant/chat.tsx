'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useT } from '../locale-provider';
import type { AssistantEntry, AssistantQuestion } from './content';
import { searchAgencyContent, STAFF_MANUAL_PATH } from './content-agency';

/**
 * The agency help panel, as a conversation.
 *
 * CURATED, NOT GENERATED, AND THAT IS THE POINT. Every answer here is a string
 * from the catalogue, traced to `docs/manuals/Staff-Web-Manual.md`. There is no
 * model behind it and nothing is composed at runtime, so it cannot invent a
 * figure, a threshold or a rule — which matters for a system holding a rent
 * ledger, and matters more in the sealed on-site mode where the box has no
 * internet and no way to reach one if it wanted to.
 *
 * What the chat shape buys is not intelligence, it is approach. A reader with a
 * question types it or taps it instead of scanning a list of headings for the
 * one that matches, and the thread keeps what they have already asked.
 *
 * The free-text box searches the curated set by word overlap. When nothing
 * scores well enough it SAYS SO and offers the suggestions again, rather than
 * returning the least-bad match — a confident wrong answer is the one failure
 * mode this design exists to avoid.
 */

type Turn =
  | { id: number; role: 'bot'; text: string; section?: string }
  | { id: number; role: 'user'; text: string };

/** Long enough to read as a reply arriving, short enough not to feel slow. */
const REPLY_DELAY_MS = 420;

export default function AssistantChat({ entry }: { entry: AssistantEntry }) {
  const t = useT();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Spelled out rather than `Omit<Turn, 'id'>`: Omit does not distribute over
  // a union, so that form silently drops `section` from the bot variant.
  type NewTurn =
    | { role: 'bot'; text: string; section?: string }
    | { role: 'user'; text: string };

  const push = useCallback((turn: NewTurn) => {
    setTurns((prev) => [...prev, { ...turn, id: nextId.current++ }]);
  }, []);

  // The opener: what this page is for, then an invitation. Posted once.
  useEffect(() => {
    push({ role: 'bot', text: entry.purpose });
    push({ role: 'bot', text: t('assistant.chat.opener') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every pending reply is cancelled on unmount, so a panel closed mid-reply
  // cannot set state on a component that is gone.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Post the question, then the answer a beat later. */
  const answer = useCallback(
    (question: string, body: string, section?: string) => {
      push({ role: 'user', text: question });
      setThinking(true);
      const timer = setTimeout(() => {
        setThinking(false);
        push({ role: 'bot', text: body, section });
      }, REPLY_DELAY_MS);
      timers.current.push(timer);
    },
    [push],
  );

  const ask = useCallback(
    (q: AssistantQuestion) => {
      setAsked((prev) => [...prev, q.q]);
      answer(q.q, q.a);
    },
    [answer],
  );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const query = draft.trim();
      if (!query) return;
      setDraft('');
      const hit = searchAgencyContent(query, t);
      if (hit) answer(query, hit.a, hit.section);
      else answer(query, t('assistant.chat.noMatch'));
    },
    [draft, answer, t],
  );

  // Keep the newest turn in view, including the typing indicator.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    // `scrollTo` is optional-chained because it is not universally present on
    // elements — jsdom has no implementation, and neither do some embedded
    // webviews. Falling back to assignment keeps the newest turn in view.
    if (typeof log.scrollTo === 'function') {
      log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    } else {
      log.scrollTop = log.scrollHeight;
    }
  }, [turns, thinking]);

  const remaining = entry.questions.filter((q) => !asked.includes(q.q));

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('assistant.chat.conversation')}
        className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm"
      >
        {turns.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="flex justify-end">
              <p
                className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-onbrand"
                style={{ background: 'var(--brand)' }}
              >
                {turn.text}
              </p>
            </div>
          ) : (
            <div key={turn.id} className="flex justify-start">
              <div
                className="max-w-[90%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-ink"
                style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
              >
                <p>{turn.text}</p>
                {turn.section && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    {t('assistant.chat.fromSection', { section: turn.section })}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {thinking && (
          <div className="flex justify-start">
            <p
              className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-muted"
              style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
            >
              <span className="sr-only">{t('assistant.chat.thinking')}</span>
              <span aria-hidden className="inline-flex gap-1">
                <Dot delay="0ms" />
                <Dot delay="140ms" />
                <Dot delay="280ms" />
              </span>
            </p>
          </div>
        )}
      </div>

      {remaining.length > 0 && (
        <div className="mt-3 shrink-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {t('assistant.chat.suggestions')}
          </p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((q) => (
              <button
                key={q.q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-ink
                           transition hover:border-brand/50 hover:text-brand"
              >
                {q.q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex shrink-0 items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('assistant.chat.placeholder')}
          aria-label={t('assistant.chat.placeholder')}
          className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 py-2.5 text-sm
                     text-ink outline-none placeholder:text-muted focus:border-brand/50"
        />
        <button
          type="submit"
          aria-label={t('assistant.chat.send')}
          disabled={!draft.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-onbrand
                     transition disabled:opacity-40"
          style={{ background: 'var(--brand)' }}
        >
          <Send size={16} />
        </button>
      </form>

      <p className="mt-3 flex shrink-0 items-start gap-1.5 border-t border-line pt-3 text-[11px] text-muted">
        <Sparkles size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          {t('assistant.chat.curatedNote')}{' '}
          <span className="font-mono">({STAFF_MANUAL_PATH})</span>
        </span>
      </p>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
      style={{ background: 'currentColor', animationDelay: delay }}
    />
  );
}
