'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { useBrand } from './brand-provider';

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const b = useBrand();
  if (path === '/login') return null;
  const logout = () => { auth.clear(); router.replace('/login'); };
  const link = (href: string, label: string) => (
    <Link href={href} className={path === href ? 'active' : ''}>{label}</Link>
  );
  return (
    <div className="nav">
      <span className="brand">
        {b.logo.imageUrl
          ? <img className="brand-logo" src={b.logo.imageUrl} alt="" />
          : <span className="brand-tile">{b.logo.text.trim()[0]?.toUpperCase() ?? 'P'}</span>}
        {b.logo.text}
      </span>
      {link('/', 'Dashboard')}
      {link('/listings', 'Listings')}
      {link('/applications', 'Applications')}
      {link('/owners', 'Owners')}
      {link('/settings', 'Settings')}
      <span className="spacer" />
      <a onClick={logout} style={{ cursor: 'pointer' }}>Sign out</a>
    </div>
  );
}
