import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MANUAL_PATH, slugify } from '@/components/assistant/content';

/**
 * The Partner Manual, served read-only to partners.
 *
 * Added by Phase 2 Day 8 under the amended constraint that allows exactly one
 * new partner route, for the manual only. The markdown is read from disk at
 * render time by this server component: no new endpoint, no new table, and no
 * copy of the manual's text anywhere in the app — `docs/manuals/Partner-Manual.md`
 * stays the single source of truth.
 *
 * Deliberately absent from `PARTNER_NAV`. The route is reached from the help
 * panel's pointer, which is where a partner is when they want it; putting it in
 * the sidebar would make it an eighth top-level destination it does not earn.
 */

/** Dynamic so an edit to the manual shows without a rebuild. */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Partner Manual' };

/**
 * `MANUAL_PATH` is relative to the repo root; Next runs with `web-admin` as the
 * working directory, so the repo root is one level up. Both are tried, because
 * a standalone build can be launched from either.
 */
function readManual(): string | null {
  const candidates = [
    path.join(process.cwd(), '..', MANUAL_PATH),
    path.join(process.cwd(), MANUAL_PATH),
  ];
  for (const file of candidates) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      // try the next candidate
    }
  }
  return null;
}

type Block =
  | { kind: 'h1' | 'h2'; text: string; id: string }
  | { kind: 'p' | 'quote'; lines: string[] }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][] };

/**
 * A deliberately small markdown subset — headings, paragraphs, block quotes,
 * rules, pipe tables, and inline bold and code. That is everything the manual
 * uses; `web-admin` has no markdown dependency and this route is not a reason
 * to add one. If the manual ever grows lists or code fences, extend this rather
 * than letting them render as flat text.
 */
function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] | null = null;
  let quote: string[] | null = null;

  const flush = () => {
    if (para) blocks.push({ kind: 'p', lines: para });
    if (quote) blocks.push({ kind: 'quote', lines: quote });
    para = null;
    quote = null;
  };

  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = /^(#{1,2})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const text = heading[2].trim();
      blocks.push({ kind: heading[1].length === 1 ? 'h1' : 'h2', text, id: slugify(text) });
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    if (line.startsWith('|')) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      let j = i + 1;
      // The alignment row (|---|---|) carries no content.
      if (j < lines.length && /^\|[\s:|-]+$/.test(lines[j])) j += 1;
      while (j < lines.length && lines[j].startsWith('|')) {
        rows.push(cells(lines[j]));
        j += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      i = j - 1;
      continue;
    }

    if (line.startsWith('> ')) {
      if (para) flush();
      quote = quote ?? [];
      quote.push(line.slice(2));
      continue;
    }

    if (quote) flush();
    para = para ?? [];
    para.push(line);
  }

  flush();
  return blocks;
}

/** Inline bold and code only — the manual contains no inline links. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    n += 1;
    if (match[1] !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-b${n}`} className="font-semibold text-ink">
          {match[1]}
        </strong>,
      );
    } else {
      out.push(
        <code key={`${keyPrefix}-c${n}`} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em]">
          {match[2]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case 'h1':
            return (
              <h1 key={key} id={block.id} className="scroll-mt-24 font-heading text-2xl font-bold text-ink">
                {block.text}
              </h1>
            );
          case 'h2':
            return (
              <h2
                key={key}
                id={block.id}
                className="scroll-mt-24 border-t border-line pt-6 font-heading text-lg font-bold text-ink"
              >
                {block.text}
              </h2>
            );
          case 'rule':
            return <hr key={key} className="border-line/60" />;
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 border-line pl-4 italic">
                {inline(block.lines.join(' '), key)}
              </blockquote>
            );
          case 'table':
            return (
              <div key={key} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {block.head.map((cell, c) => (
                        <th key={c} className="border-b border-line py-2 pr-4 font-semibold text-ink">
                          {inline(cell, `${key}-h${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className="border-b border-line/60 py-2 pr-4 align-top">
                            {inline(cell, `${key}-r${r}c${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{inline(block.lines.join(' '), key)}</p>;
        }
      })}
    </>
  );
}

export default function PartnerManualPage() {
  const markdown = readManual();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/partner"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to the portal
      </Link>

      {markdown ? (
        <article className="space-y-4 text-[15px] leading-relaxed text-muted">
          <Blocks blocks={parse(markdown)} />
        </article>
      ) : (
        <div className="rounded-2xl border border-line p-6 text-sm text-muted">
          <p className="font-medium text-ink">The manual is not available on this server.</p>
          <p className="mt-1">
            It is read from <span className="font-mono">{MANUAL_PATH}</span> at render time. Ask support for a copy.
          </p>
        </div>
      )}
    </div>
  );
}
