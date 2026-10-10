'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import { useLocale } from './locale-provider';

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
  total, limit, offset, onChange, noun,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  /** Already translated by the caller — the page knows what it is listing, and
   * a noun list in here would be a second place to keep in step. */
  noun?: string;
}) {
  const { t, number } = useLocale();
  if (total <= limit) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="text-muted">
        {/* Was `toLocaleString('en-ZA')`: hardcoded South African grouping,
            which is wrong under any other locale. */}
        {t('pager.summary', {
          count: number(total, 0),
          noun: noun ?? t('pager.noun.rows'),
          page,
          pages,
        })}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft size={16} /> {t('pager.previous')}
        </Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          {t('pager.next')} <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
