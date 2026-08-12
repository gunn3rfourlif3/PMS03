'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, thumbUrl } from '@/lib/api';
import { brandKey } from '@/lib/branding';
import { useBrand } from '@/components/brand-provider';
import { formatAddress, formatDate } from '@/components/public-chrome';

/* ------------------------------------------------------------------ *
 * Dan Talan Properties — Rentals index.
 * Faithful reproduction of the "Premium Minimalist Property Portfolio"
 * design (Cormorant Garamond + Inter, cream / ink / taupe). Everything
 * is driven by the live active listings, and every year/date is derived
 * from them so the page stays current on its own.
 * ------------------------------------------------------------------ */

const PAPER = '#F9F7F2';
const INK = '#121212';
const TAUPE = '#C4B5A0';
const MUTED = '#6b6357';
const LINE = '#e4ded2';

interface Item {
  id: string;
  no: string;
  name: string;
  unit: string;
  location: string;
  year: string;
  kind: string;        // property type — Apartment / House / …
  beds: string;        // "Studio" | "2 Bed"
  baths: string;       // "2 Bath"
  size: string;        // "100 m²" | "—"
  available: string;   // "1 Aug 2026"
  status: string;
  price: string;
  image?: string;
  description?: string;
  href: string;
}

/* Elegant on-brand placeholder for listings with no photo. */
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">` +
    `<rect width="640" height="480" fill="#EDEBE4"/>` +
    `<g fill="none" stroke="#C4B5A0" stroke-width="2">` +
    `<path d="M250 250 L320 200 L390 250 L390 320 L250 320 Z"/>` +
    `<path d="M300 320 L300 280 L340 280 L340 320"/></g>` +
    `<text x="320" y="378" text-anchor="middle" fill="#8a8175" font-family="Georgia,serif" font-size="20" letter-spacing="3">DAN TALAN PROPERTIES</text>` +
    `</svg>`,
  );

const zar = (n: any) =>
  'R' + Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const spell = (n: number) => WORDS[n] ?? String(n);

function yearOf(l: any): string {
  const raw = l.availableFrom || l.createdAt;
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? String(d.getFullYear()) : String(new Date().getFullYear());
}

function toItem(l: any, i: number): Item {
  const beds = l.bedrooms === 0 || l.bedrooms === '0' ? 'Studio' : `${l.bedrooms} Bed`;
  return {
    id: l.id,
    no: String(i + 1).padStart(2, '0'),
    name: l.propertyName || l.unitLabel || 'Residence',
    unit: l.unitLabel || '',
    location: formatAddress(l.address) || l.unitLabel || 'South Africa',
    year: yearOf(l),
    kind: l.propertyType ? String(l.propertyType).replace(/^\w/, (c: string) => c.toUpperCase()) : 'Residential',
    beds,
    baths: `${l.bathrooms || 1} Bath`,
    size: l.sizeSqm ? `${l.sizeSqm} m²` : '—',
    available: formatDate(l.availableFrom) || 'Now',
    status: 'Available',
    price: `${zar(l.rent)} / month`,
    image: l.media?.[0] ? thumbUrl(l.media[0]) : undefined,
    description: l.description,
    href: `/l/${l.id}`,
  };
}

export default function RentalsPage() {
  const b = useBrand();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState<Item | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    api.publicListings(brandKey())
      .then((rows) => setItems((rows || []).map(toItem)))
      .catch(() => setItems([]));
  }, []);

  const now = new Date().getFullYear();
  const brandName = b.name || 'Dan Talan Properties';

  const years = useMemo(() => (items || []).map((x) => Number(x.year)).filter(Boolean), [items]);
  const minY = years.length ? Math.min(...years) : now;
  const maxY = years.length ? Math.max(...years) : now;
  const span = minY === maxY ? `${maxY}` : `${minY}—${maxY}`;

  const cities = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((x) => { const c = x.location.split(',').pop()?.trim(); if (c) set.add(c); });
    return [...set];
  }, [items]);
  const region = cities.length ? cities.slice(0, 2).join(' & ') : 'South Africa';

  const cats = useMemo(() => {
    const s = new Set<string>();
    (items || []).forEach((x) => s.add(x.kind));
    return ['All', ...[...s]];
  }, [items]);

  const shown = (items || []).filter((x) => filter === 'All' || x.kind === filter);
  const featured = (items || [])[0];
  const count = (items || []).length;

  const cap = { fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: MUTED };
  const serif = { fontFamily: '"Cormorant Garamond", Georgia, serif' };

  return (
    <div style={{ background: PAPER, color: INK, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500&display=swap"
      />

      {/* ---- Header ---- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(249,247,242,.85)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', height: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span aria-hidden />
          <nav style={{ display: 'flex', gap: 40, alignItems: 'center' }} className="dt-nav">
            <span style={{ ...cap }}>Index — Property List</span>
            <span style={{ ...cap }}>Manifesto — Philosophy</span>
            <span style={{ ...cap }}>Contact — Studio</span>
          </nav>
          <button onClick={() => setMenu((m) => !m)} className="dt-menu" style={{ ...cap, background: 'none', border: `1px solid ${INK}`, padding: '10px 18px', borderRadius: 2, cursor: 'pointer', color: INK, display: 'none' }}>
            Menu
          </button>
        </div>
      </header>

      {menu && (
        <div style={{ borderBottom: `1px solid ${LINE}`, padding: '18px 40px' }} className="dt-menu-panel">
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 12 }}>
            {['Index — Property List', 'Manifesto — Philosophy', 'Contact — Studio'].map((t) => (
              <span key={t} style={{ ...cap, fontSize: 13 }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ---- Masthead ---- */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 0' }}>
        <div style={{ position: 'relative' }}>
          <h1 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(64px,13vw,190px)', lineHeight: 0.9, letterSpacing: '-0.01em' }}>
            Rentals&nbsp;/<br />
            <span style={{ fontStyle: 'italic' }}>Portfolio {now}</span>
          </h1>
          <span style={{ ...serif, position: 'absolute', right: 0, bottom: 8, fontSize: 22, whiteSpace: 'nowrap' }} className="dt-no">
            No. {String(count).padStart(2, '0')} / {now}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginTop: 40 }}>
          <span style={{ width: 44, height: 1, background: INK, marginTop: 10, flex: 'none' }} />
          <p style={{ maxWidth: '34ch', color: MUTED, fontSize: 15, lineHeight: 1.6 }}>
            Curated properties. Considered design. {spell(count)} spaces selected for permanence, light,
            and material honesty across {region}.
          </p>
        </div>

        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 56 }} />
      </section>

      {/* ---- Manifesto band ---- */}
      <section style={{ background: '#F0EFE9' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, ...cap, marginBottom: 40 }}>
            <span>Manifesto</span>
            <span>Selected Works {span}</span>
            <span>Scroll — Index</span>
          </div>
          <h2 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(40px,7vw,96px)', lineHeight: 0.98, letterSpacing: '-0.02em' }}>
            We don&rsquo;t list properties.<br />
            We present spaces<br />
            <span style={{ fontStyle: 'italic', color: TAUPE }}>that endure.</span>
          </h2>
        </div>
      </section>

      {/* ---- Featured ---- */}
      {featured && (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 0' }}>
          <div style={{ ...cap, marginBottom: 20 }}>Featured — {featured.year}</div>
          <Link href={featured.href} style={{ display: 'block' }} className="dt-feature">
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/8', overflow: 'hidden', background: '#eee' }}>
              <img src={featured.image || PLACEHOLDER} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginTop: 22 }}>
              <div>
                <h2 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(34px,4.5vw,56px)', lineHeight: 1 }}>{featured.name}</h2>
                <div style={{ color: MUTED, marginTop: 8 }}>{featured.unit ? `${featured.unit} · ` : ''}{featured.location}</div>
              </div>
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {[['Type', featured.kind], ['Beds', featured.beds], ['Baths', featured.baths], ['Size', featured.size], ['Available', featured.available], ['Rent', featured.price]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ ...cap, marginBottom: 6 }}>{k}</div>
                    <div style={{ ...serif, fontSize: 22 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ---- Filter ---- */}
      {cats.length > 1 && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)} style={{
              ...cap, fontSize: 12, padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${filter === c ? INK : LINE}`, background: filter === c ? INK : 'transparent',
              color: filter === c ? PAPER : MUTED, fontFamily: 'Inter, sans-serif',
            }}>{c}</button>
          ))}
        </div>
      )}

      {/* ---- Index list ---- */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px 40px' }}>
        {items === null ? (
          <p style={{ color: MUTED, padding: '40px 0' }}>Loading…</p>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '96px 20px 80px', borderTop: `1px solid ${LINE}` }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke={TAUPE} strokeWidth="1.5"
              style={{ margin: '0 auto 28px', display: 'block' }} aria-hidden>
              <path d="M12 26 L28 13 L44 26 L44 45 L12 45 Z" />
              <path d="M23 45 L23 33 L33 33 L33 45" />
            </svg>
            <div style={{ ...cap, marginBottom: 14 }}>The index is resting</div>
            <h3 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(34px,5vw,56px)', lineHeight: 1.02, letterSpacing: '-0.01em' }}>
              {filter !== 'All'
                ? <>No {filter.toLowerCase()} homes<br />available right now</>
                : <>No rentals available<br /><span style={{ fontStyle: 'italic', color: TAUPE }}>right now</span></>}
            </h3>
            <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.6, maxWidth: '42ch', margin: '18px auto 0' }}>
              {filter !== 'All'
                ? 'Nothing in this category at the moment — the full collection may have something for you.'
                : 'Our homes are leased quickly. New listings appear here the moment they become available.'}
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 34 }}>
              {filter !== 'All' && (
                <button onClick={() => setFilter('All')} style={{ ...cap, fontSize: 12, background: INK, color: PAPER, border: 0, padding: '14px 24px', borderRadius: 2, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  View all homes
                </button>
              )}
              {b.contact?.email && (
                <a href={`mailto:${b.contact.email}?subject=Register%20my%20interest%20—%20rentals`} style={{ ...cap, fontSize: 12, border: `1px solid ${INK}`, padding: '14px 24px', borderRadius: 2, color: INK }}>
                  Register your interest →
                </a>
              )}
            </div>
          </div>
        ) : shown.map((x, i) => (
          <div key={x.id} className="dt-row" style={{
            display: 'grid', gridTemplateColumns: i % 2 ? '1fr 1.15fr' : '1.15fr 1fr',
            gap: 56, alignItems: 'center', padding: '52px 0', borderTop: `1px solid ${LINE}`,
          }}>
            <Link href={x.href} style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3', background: '#eee', order: i % 2 ? 2 : 0 }} className="dt-rimg">
              <img src={x.image || PLACEHOLDER} alt={x.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ ...serif, position: 'absolute', left: 20, top: 14, fontSize: 26, color: '#fff', mixBlendMode: 'difference' }}>{x.no}</span>
            </Link>
            <div style={{ order: i % 2 ? 1 : 0 }}>
              <div style={{ ...cap }}>{x.kind} &nbsp;/&nbsp; {x.status}</div>
              <h3 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(38px,5vw,60px)', lineHeight: 1, margin: '16px 0 10px' }}>{x.name}</h3>
              <div style={{ color: MUTED }}>{x.unit ? `${x.unit} · ` : ''}{x.location}, {x.year}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px', marginTop: 22, fontSize: 13, color: INK }}>
                <span>{x.beds}</span><span>{x.baths}</span><span>{x.size}</span><span>Available {x.available}</span>
              </div>
              {x.description && <p style={{ color: MUTED, marginTop: 16, fontSize: 14, lineHeight: 1.6, maxWidth: '46ch', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.description}</p>}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, marginTop: 26, borderTop: `1px solid ${LINE}`, paddingTop: 20 }}>
                <span style={{ ...serif, fontSize: 30 }}>{x.price}</span>
                <button onClick={() => setOpen(x)} style={{ ...cap, fontSize: 12, background: 'none', border: 0, cursor: 'pointer', color: INK, fontFamily: 'Inter, sans-serif' }}>
                  View Dossier →
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ---- Dossier overlay ---- */}
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(18,18,18,.55)', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', height: '100%', background: PAPER, overflowY: 'auto', padding: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...cap }}>Dossier · {open.no}</span>
              <button onClick={() => setOpen(null)} style={{ ...cap, background: 'none', border: 0, cursor: 'pointer' }}>Close ✕</button>
            </div>
            <img src={open.image || PLACEHOLDER} alt={open.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', marginTop: 20 }} />
            <h2 style={{ ...serif, fontWeight: 500, fontSize: 44, lineHeight: 1, margin: '24px 0 6px' }}>{open.name}</h2>
            <div style={{ color: MUTED }}>Managed by {brandName}</div>
            {open.description && <p style={{ color: MUTED, marginTop: 18, lineHeight: 1.6 }}>{open.description}</p>}
            <div style={{ marginTop: 24, borderTop: `1px solid ${LINE}` }}>
              {[['Property', open.name], ['Unit', open.unit || '—'], ['Type', open.kind], ['Bedrooms', open.beds], ['Bathrooms', open.baths], ['Size', open.size], ['Location', open.location], ['Available from', open.available], ['Rent', open.price], ['Status', open.status]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: `1px solid ${LINE}` }}>
                  <span style={{ ...cap }}>{k}</span>
                  <span style={{ fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>
            <Link href={open.href} style={{ display: 'inline-block', marginTop: 26, ...cap, fontSize: 12, border: `1px solid ${INK}`, padding: '14px 22px', borderRadius: 2 }}>
              View &amp; apply →
            </Link>
          </div>
        </div>
      )}

      {/* ---- Footer ---- */}
      <footer style={{ background: INK, color: PAPER, marginTop: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 40px 48px' }}>
          <div style={{ display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} className="dt-foot">
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>
              <div style={{ ...cap, color: 'rgba(255,255,255,.55)', marginBottom: 28 }}>Find your next home</div>
              <h2 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(40px,7vw,84px)', lineHeight: 1 }}>
                Let&rsquo;s get you <span style={{ fontStyle: 'italic', color: TAUPE }}>moved in</span>
              </h2>
              <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', marginTop: 56 }}>
                {[[String(count).padStart(2, '0'), 'Spaces'], [String(Math.max(1, now - 2019)), 'Years Active'], ['100%', 'Managed'], [span, 'Editions']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ ...serif, fontSize: 40 }}>{n}</div>
                    <div style={{ ...cap, color: 'rgba(255,255,255,.55)' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <img src="/brand/dantalan-logo-dark.jpeg" alt={brandName} style={{ flex: '0 0 auto', width: 'min(440px, 42vw)', height: 'auto' }} className="dt-foot-logo" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginTop: 56, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.16)', ...cap, color: 'rgba(255,255,255,.6)' }}>
            <span>© {now} {brandName} — All spaces documented with consent.</span>
            <span>{b.contact?.email || 'hello@dantalan.co.za'}</span>
            <span>{b.contact?.phone || '+27 11 000 0000'}</span>
            {/* Attribution: every agency's listings site links back to the platform.
                Deliberately quiet — it must never compete with the agency's brand. */}
            <span>
              Powered by{' '}
              <a href="https://locare.co.za" target="_blank" rel="noopener"
                style={{ color: 'rgba(255,255,255,.85)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,.3)' }}>
                Locare
              </a>
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        .dt-rimg img, .dt-feature img { transition: transform .6s ease; }
        .dt-row:hover .dt-rimg img, .dt-feature:hover img { transform: scale(1.04); }
        @media (max-width: 820px) {
          .dt-nav { display: none !important; }
          .dt-menu { display: inline-block !important; }
          .dt-row { grid-template-columns: 1fr !important; gap: 24px !important; }
          .dt-row > a { order: 0 !important; }
          .dt-no { position: static !important; display: block; margin-top: 12px; }
          .dt-foot { flex-direction: column; align-items: flex-start !important; }
          .dt-foot-logo { width: 260px !important; margin-top: 8px; }
        }
      `}</style>
    </div>
  );
}
