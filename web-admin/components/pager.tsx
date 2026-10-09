'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';

/**
 * Page controls for a server-paged table.
 *
 * Exists because a 500-unit portfolio turned the rent roll into one enormous
 * scroll — fine at the seven units of the old demo agency, not fine in front of
 * a client. Server-paged, not a client-side slice: slicing in the browser still
 * ships every row.
 *
 * Renders nothing when everything fits on one page, so small agencies never see
 * a control they do not need.
 */
export default function Pager({
  total, limit, offset, onChange, noun = 'rows',
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  noun?: string;
}) {
  if (total <= limit) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="text-muted">
        {total.toLocaleString('en-ZA')} {noun} · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft size={16} /> Previous
        </Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
