import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public rentals host (rentals.<domain>): serve ONLY the public rentals pages,
 * with no auth. The root path shows the browse index; any back-office route is
 * redirected to it. Other hosts (app.<domain>) are unaffected.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  if (!host.startsWith('rentals.')) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === '/rentals' || pathname.startsWith('/rentals/') || pathname.startsWith('/l/');
  if (isPublic) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/rentals';
  url.search = '';
  // Root serves the browse page in place; anything else redirects to it.
  return pathname === '/' ? NextResponse.rewrite(url) : NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
