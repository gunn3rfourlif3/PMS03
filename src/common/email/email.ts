/**
 * Tiny branded HTML email builder. Produces a clean card with a heading,
 * paragraphs and call-to-action buttons — so links read as "click here" buttons
 * rather than raw URLs. Plain-text bodies are still sent alongside as a fallback.
 */
const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface EmailButton { label: string; url: string; }

export interface EmailOptions {
  heading: string;
  paragraphs?: string[];
  buttons?: EmailButton[];
  agencyName?: string;
  brandColor?: string;
  footerNote?: string;
}

export function renderEmail(o: EmailOptions): string {
  const brand = o.brandColor || '#0F6E56';
  const paras = (o.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${esc(p)}</p>`)
    .join('');
  const buttons = (o.buttons ?? [])
    .map((b) => `<tr><td style="padding:5px 0"><a href="${esc(b.url)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${esc(b.label)}</a></td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #eaeaea;border-radius:16px;overflow:hidden">
    <div style="background:${brand};height:6px"></div>
    <div style="padding:28px 30px">
      ${o.agencyName ? `<div style="font-size:13px;font-weight:600;color:${brand};margin-bottom:6px">${esc(o.agencyName)}</div>` : ''}
      <h1 style="margin:0 0 14px;font-size:22px;color:#111827">${esc(o.heading)}</h1>
      ${paras}
      ${buttons ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 2px">${buttons}</table>` : ''}
      ${o.footerNote ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#374151">${esc(o.footerNote)}</p>` : ''}
      ${o.agencyName ? `<div style="margin-top:22px;border-top:1px solid #eee;padding-top:14px;font-size:13px;color:#6b7280">— The ${esc(o.agencyName)} team</div>` : ''}
    </div>
  </div></body></html>`;
}
