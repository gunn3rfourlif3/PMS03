/**
 * Branded HTML email builder.
 *
 * Every transactional email Locare sends renders through here, including
 * white-labelled agency mail — so the Locare palette is the DEFAULT, not a
 * hard-coded constant. Pass `brandColor` and `agencyName` and the whole
 * template re-tints, which is the point of a white-label product.
 *
 * Email client constraints this obeys, learned the hard way:
 *   · Tables for layout. Outlook's rendering engine is Word, and it has no
 *     flexbox or grid.
 *   · Inline styles only. Gmail strips <style> blocks in several contexts.
 *   · No SVG, no webfonts. Gmail drops both; the wordmark is live text and the
 *     stack falls back through Segoe UI to system sans.
 *   · Tints are computed, not hard-coded, so an agency's brand colour produces
 *     a matching panel rather than a Locare-green one.
 */
const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Mix a hex colour toward white. `amount` 0..1, where 1 is white. */
function tint(hex: string, amount: number): string {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const mix = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

/** Darken a hex toward black, for the header band and hover-ish states. */
function shade(hex: string, amount: number): string {
  const h = (hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const mix = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16);
    return Math.round(v * (1 - amount)).toString(16).padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif`;
const INK = '#14161B';
const BODY = '#414751';
const MUTED = '#8A8F98';
const LINE = '#E6EAEF';
/** The page behind the card. Cool and light, so the white card lifts off it. */
const PAPER = '#F1F5F9';
/**
 * Header bar. A deep Locare blue rather than near-black: the ink bar was
 * technically fine and read as a utility notification. Same contrast, warmer
 * feeling, and it actually looks like the brand.
 */
const HEADER_DARK = '#17455C';
/**
 * The warm counterweight. Blue alone is competent and cold; one warm accent on
 * the rules and the eyebrow is most of the difference between an email that
 * looks like a receipt and one somebody enjoys opening. Used sparingly — it is
 * seasoning, not a second brand colour.
 */
const WARM = '#E4943A';

export interface EmailButton { label: string; url: string; }

/**
 * A picture — a video poster, a screenshot — optionally linking somewhere.
 *
 * Same raster-only, https-only rule as the header logo: Gmail and Outlook drop
 * SVG, and an http:// or relative src is blocked or unresolvable in the
 * recipient's client. Anything else is silently omitted rather than rendered as
 * a broken-image icon, so the email still reads correctly without it — which is
 * also how most recipients first see it, since images are blocked by default.
 * That is why `alt` is required and why a media block is never the only link.
 */
export interface EmailMedia {
  imageUrl: string;
  href?: string;
  alt: string;
  caption?: string;
}

const MAIL_SAFE_IMG = /^https:\/\/\S+\.(png|jpe?g|gif)(\?\S*)?$/i;

/** A small data table. Two or three columns — wider wraps badly on a phone. */
export interface EmailTable { head: string[]; rows: string[][]; }

/** A titled block. `callout` renders as a tinted panel — use it for one number. */
export interface EmailSection {
  title?: string;
  paragraphs?: string[];
  table?: EmailTable;
  callout?: { label?: string; value: string; note?: string };
  /**
   * "Here is the one thing to do about this." A warm strip, set at reading size.
   *
   * Distinct from `callout`, which sets its value at 26px because it exists to
   * show ONE NUMBER. Putting a sentence through it produces a headline that
   * shouts — which is how the first partner update read.
   */
  action?: { label?: string; text: string };
}

/**
 * One entry in a numbered digest — a product update, a list of changes.
 *
 * Deliberately separate from `EmailSection`. Sections are the prose layout every
 * other email uses; this is a LIST of independent things, and it reads as one:
 * a numbered rail, a coloured label, and a sentence-case title at a size a
 * person can actually read. The small-caps section headings work for "here is
 * the next part of this letter" and fall apart for "here are six things".
 */
export interface EmailItem {
  /** Short category, e.g. "Pricing". Rendered in `labelColor`. */
  label?: string;
  /** Category colour. Colour is doing work here: a partner scanning on a phone
   *  can see which updates touch their money without reading a word. */
  labelColor?: string;
  title: string;
  body: string;
  action?: { label?: string; text: string };
}

export interface EmailOptions {
  heading: string;
  /** Hidden preview line shown in the inbox list. Worth setting on every email. */
  preheader?: string;
  paragraphs?: string[];
  sections?: EmailSection[];
  /** A numbered digest. Rendered after `sections`, before the media block. */
  items?: EmailItem[];
  buttons?: EmailButton[];
  /** Rendered between the copy and the buttons. Omitted if not mail-safe. */
  media?: EmailMedia;
  agencyName?: string;
  /**
   * Absolute URL to a PNG/JPG logo for the header. Must NOT be an SVG — Gmail
   * and Outlook drop those. Rendered at 26px tall on the dark header bar, so a
   * light/white-on-transparent mark works best; `agencyName` is the alt text,
   * which is what most recipients see first because images are blocked by
   * default.
   */
  logoUrl?: string;
  /**
   * Public base URL of the API (`PUBLIC_API_BASE`). When there is no `logoUrl`,
   * the neutral fallback mark is served from `${markUrl}/brand/email-mark-*.png`.
   * Omit it and the header falls back to the wordmark alone, which is still a
   * perfectly good email — the mark is decoration, not information.
   */
  markUrl?: string;
  /** Small label in the header bar, e.g. "Partner programme". Omit for most mail. */
  eyebrow?: string;
  /**
   * Header bar treatment. Defaults to `ink` for wordmark-only mail and `light`
   * when a `logoUrl` is supplied, because an agency's stored logo is the one
   * their apps render on a white header — almost always dark-on-transparent,
   * which is invisible on an ink bar. Pass `ink` explicitly when the logo is a
   * light/white variant.
   */
  headerStyle?: 'ink' | 'light';
  brandColor?: string;
  footerNote?: string;
  /** Small print below the divider — disclaimers, calculation basis. */
  fineprint?: string;
}

export function renderEmail(o: EmailOptions): string {
  // Locare's own blue. The previous default was a green that appears nowhere in
  // the brand — every Locare email was rendering in the wrong colour, which is
  // the sort of thing only shows up when you put the email next to the site.
  const brand = o.brandColor || '#2D6A8F';
  const accent = WARM;
  const brandDark = shade(brand, 0.42);
  const brandTint = tint(brand, 0.9);
  const brandEdge = tint(brand, 0.72);
  const wordmark = o.agencyName || 'Locare';
  const darkHeader = o.headerStyle ? o.headerStyle === 'ink' : !o.logoUrl;
  const headerBg = darkHeader ? HEADER_DARK : '#ffffff';
  // background-color first, background-image second: Outlook ignores gradients
  // and keeps the solid, everything else gets the depth.
  const headerStyleCss = darkHeader
    ? `background-color:${HEADER_DARK};background-image:linear-gradient(135deg, ${shade(brand, 0.55)} 0%, ${HEADER_DARK} 55%, ${shade(brand, 0.3)} 100%)`
    : `background-color:#ffffff`;
  const headerInk = darkHeader ? '#ffffff' : INK;
  const headerMuted = darkHeader ? 'rgba(255,255,255,.55)' : MUTED;

  // No uploaded logo → a neutral transparent-PNG mark next to the name, rather
  // than a bare wordmark. The name stays live text on purpose: Gmail and
  // Outlook block images by default, so an image-only header would read as
  // empty to most recipients and they would not see who sent it.
  const markUrl = o.markUrl && !o.logoUrl
    ? `${o.markUrl.replace(/\/+$/, '')}/brand/email-mark-${darkHeader ? 'white' : 'ink'}.png`
    : undefined;

  const brandLockup = o.logoUrl
    ? `<img src="${esc(o.logoUrl)}" alt="${esc(wordmark)}" height="26" style="height:26px;width:auto;max-width:200px;display:block;border:0;outline:none;text-decoration:none">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
         ${markUrl
           ? `<td style="padding-right:10px;font-size:0;line-height:0"><img src="${esc(markUrl)}" alt="" width="22" height="22" style="width:22px;height:22px;display:block;border:0;outline:none"></td>`
           : ''}
         <td style="font-family:${FONT};font-size:19px;font-weight:700;color:${headerInk};letter-spacing:-.01em">${esc(wordmark)}</td>
       </tr></table>`;

  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15.5px;line-height:1.65;color:${BODY}">${esc(t)}</p>`;

  const paras = (o.paragraphs ?? []).map(p).join('');

  const renderTable = (t?: EmailTable) => {
    if (!t) return '';
    const head = t.head
      .map((h, i) => `<th style="text-align:${i === 0 ? 'left' : 'right'};padding:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:${MUTED};font-weight:600;border-bottom:2px solid ${brandEdge}">${esc(h)}</th>`)
      .join('');
    const body = t.rows
      .map((r, ri) => `<tr${ri % 2 ? ` style="background:${PAPER}"` : ''}>${r
        .map((c, i) => {
          const last = i === r.length - 1;
          return `<td style="text-align:${i === 0 ? 'left' : 'right'};padding:11px 12px;font-family:${FONT};font-size:15px;border-bottom:1px solid ${LINE};${
            last ? `color:${brand};font-weight:700;` : `color:${INK};`
          }">${esc(c)}</td>`;
        })
        .join('')}</tr>`)
      .join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 20px;border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const renderCallout = (c?: EmailSection['callout']) => {
    if (!c) return '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px;border-collapse:separate">
      <tr><td style="background:${brandTint};border-left:4px solid ${brand};border-radius:0 12px 12px 0;padding:18px 20px">
        ${c.label ? `<div style="font-family:${FONT};font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:${brandDark};font-weight:600;margin-bottom:6px">${esc(c.label)}</div>` : ''}
        <div style="font-family:${FONT};font-size:26px;line-height:1.15;font-weight:700;color:${brandDark};letter-spacing:-.02em">${esc(c.value)}</div>
        ${c.note ? `<div style="font-family:${FONT};font-size:13.5px;line-height:1.5;color:${shade(brand, 0.2)};margin-top:6px">${esc(c.note)}</div>` : ''}
      </td></tr></table>`;
  };

  const renderAction = (a?: EmailSection['action']) => {
    if (!a) return '';
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:2px 0 20px;border-collapse:separate">
      <tr><td style="background:${tint(WARM, 0.88)};border-left:4px solid ${WARM};border-radius:0 12px 12px 0;padding:14px 18px">
        ${a.label ? `<div style="font-family:${FONT};font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:${shade(WARM, 0.45)};font-weight:700;margin-bottom:4px">${esc(a.label)}</div>` : ''}
        <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};font-weight:600">${esc(a.text)}</div>
      </td></tr></table>`;
  };

  const sections = (o.sections ?? [])
    .map((s) => [
      s.title
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 12px"><tr>
             <td style="width:20px;border-top:2px solid ${accent};font-size:0;line-height:0">&nbsp;</td>
             <td style="padding-left:10px;font-family:${FONT};font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:${INK};font-weight:700">${esc(s.title)}</td>
           </tr></table>`
        : '',
      (s.paragraphs ?? []).map(p).join(''),
      renderTable(s.table),
      renderCallout(s.callout),
      renderAction(s.action),
    ].join(''))
    .join('');

  const items = (o.items ?? [])
    .map((it, i) => {
      const tone = it.labelColor || brand;
      const last = i === (o.items?.length ?? 0) - 1;
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <tr>
          <td width="46" valign="top" style="padding:22px 0">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;background:${tone};border-radius:15px;font-family:${FONT};font-size:13px;font-weight:700;color:#ffffff;line-height:30px">${i + 1}</td>
            </tr></table>
          </td>
          <td valign="top" style="padding:22px 0;${last ? '' : `border-bottom:1px solid ${LINE}`}">
            ${it.label ? `<div style="font-family:${FONT};font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${tone}">${esc(it.label)}</div>` : ''}
            <div style="margin:5px 0 0;font-family:${FONT};font-size:18.5px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-.015em">${esc(it.title)}</div>
            <div style="margin:8px 0 0;font-family:${FONT};font-size:15px;line-height:1.62;color:${BODY}">${esc(it.body)}</div>
            ${renderAction(it.action)}
          </td>
        </tr>
      </table>`;
    })
    .join('');

  // Fixed width as an attribute as well as CSS: Outlook ignores max-width on
  // images and will otherwise render the asset at its intrinsic size, blowing
  // the 600px card open. 536 = 600 card - 32px padding each side.
  const media = (() => {
    const m = o.media;
    if (!m || !MAIL_SAFE_IMG.test(m.imageUrl.trim())) return '';
    const img = `<img src="${esc(m.imageUrl)}" alt="${esc(m.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;outline:none;text-decoration:none">`;
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 22px;border-collapse:separate">
      <tr><td style="border:1px solid ${LINE};border-radius:12px;overflow:hidden;background:${PAPER};font-size:0;line-height:0">
        ${m.href ? `<a href="${esc(m.href)}" style="display:block;text-decoration:none">${img}</a>` : img}
      </td></tr>
      ${m.caption ? `<tr><td style="padding:8px 2px 0;font-family:${FONT};font-size:12.5px;line-height:1.5;color:${MUTED}">${esc(m.caption)}</td></tr>` : ''}
    </table>`;
  })();

  // Bulletproof-ish button: a table cell with a background, which Outlook honours
  // where a styled <a> alone collapses to a plain link.
  const buttons = (o.buttons ?? [])
    .map((b) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0"><tr>
      <td align="center" style="background-color:${brand};background-image:linear-gradient(135deg, ${brand} 0%, ${shade(brand, 0.25)} 100%);border-radius:12px">
        <a href="${esc(b.url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15.5px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:.01em">${esc(b.label)}</a>
      </td></tr></table>`)
    .join('');

  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${esc(o.preheader)}</div>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};-webkit-font-smoothing:antialiased">
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER}">
<tr><td align="center" style="padding:28px 14px 40px">

  <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE}">

    <tr><td style="${headerStyleCss};padding:22px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td>${brandLockup}</td>
        ${o.eyebrow ? `<td align="right" style="font-family:${FONT};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${darkHeader ? WARM : MUTED};font-weight:700">${esc(o.eyebrow)}</td>` : ''}
      </tr></table>
    </td></tr>

    <tr><td style="height:4px;background-color:${brand};background-image:linear-gradient(90deg, ${brand} 0%, ${brand} 62%, ${WARM} 100%);font-size:0;line-height:0">&nbsp;</td></tr>

    <tr><td style="padding:34px 32px 30px">
      <h1 style="margin:0 0 16px;font-family:${FONT};font-size:27px;line-height:1.2;font-weight:700;color:${INK};letter-spacing:-.025em">${esc(o.heading)}</h1>
      ${paras}
      ${sections}
      ${items}
      ${media}
      ${buttons}
      ${o.footerNote ? `<p style="margin:20px 0 0;font-size:14.5px;line-height:1.6;color:${BODY}">${esc(o.footerNote)}</p>` : ''}
      ${o.fineprint ? `<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid ${LINE};font-size:12px;line-height:1.55;color:${MUTED}">${esc(o.fineprint)}</p>` : ''}
    </td></tr>

    <tr><td style="background:${PAPER};padding:18px 32px;border-top:1px solid ${LINE}">
      <div style="font-family:${FONT};font-size:12.5px;line-height:1.6;color:${MUTED}">
        ${o.agencyName ? `${esc(o.agencyName)} &middot; powered by Locare` : 'Locare &middot; property management, beautifully run'}
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}
