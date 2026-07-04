'use client';
import { usePathname } from 'next/navigation';
import { useBrand } from './brand-provider';

export default function Footer() {
  const path = usePathname();
  const b = useBrand();
  if (path === '/login') return null;
  const c = b.contact;
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>{b.name}</span>
        {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
        {c.website && <a href={`https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a>}
      </div>
    </footer>
  );
}
