/**
 * Pure, dependency-free renderer for a standard South African residential lease
 * agreement. ALL interpolated values are HTML-escaped (applicant data is user
 * input). This is a STARTER template — have it reviewed by a legal professional
 * and customise clauses per your agency before relying on it.
 */

export interface LeaseAgreementData {
  agencyName: string;
  agencyEmail?: string;
  agencyPhone?: string;
  tenantName: string;
  tenantEmail?: string;
  tenantIdNumber?: string;
  propertyName: string;
  unitLabel?: string;
  addressText?: string;
  currency?: string;      // default 'R'
  rentAmount: number;
  depositAmount?: number;
  startDate: string;      // YYYY-MM-DD
  endDate?: string;
  generatedOn?: string;   // YYYY-MM-DD
  signature?: { name: string; signedAt: string; ip?: string };
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

const money = (n: number, cur = 'R'): string =>
  `${cur}${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  const dt = new Date(`${d}T00:00:00Z`);
  return isNaN(dt.getTime()) ? esc(d) : dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Placeholders an agency can use in their own lease template. */
export const LEASE_PLACEHOLDERS = [
  'agency_name', 'agency_email', 'agency_phone',
  'tenant_name', 'tenant_email', 'tenant_id_number',
  'property', 'unit', 'address',
  'rent', 'deposit', 'start_date', 'end_date', 'today', 'signature',
] as const;

const SHELL_CSS = `body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1c22;line-height:1.55;margin:0;padding:28px;max-width:820px;margin:0 auto;font-size:14.5px}
h1{font-size:20px;margin:0 0 10px}h1,h2{line-height:1.2}.plain{white-space:pre-wrap;font-family:inherit;font-size:inherit;margin:0}
table.parties{width:100%;border-collapse:collapse;margin:0 0 16px}
table.parties td{border:1px solid #e5e7eb;padding:8px 10px;font-size:13.5px;vertical-align:top}
table.parties td.k{width:34%;color:#6b7280;background:#fafafa}
.muted{color:#6b7280}
.signblock{margin-top:26px;border-top:1px solid #e5e7eb;padding-top:16px}
.signed{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px}
.sign-pending{background:#f9fafb;border:1px dashed #e5e7eb;border-radius:8px;padding:12px 14px;color:#6b7280}`;

/**
 * Agency uploaded their own lease document (PDF). We render an auto-filled deal
 * schedule + embed their lease + the signature block — no placeholders needed.
 */
export function renderLeaseWithAttachment(d: LeaseAgreementData, fileUrl: string): string {
  const cur = d.currency ?? 'R';
  const deposit = d.depositAmount ?? d.rentAmount;
  const premises = [d.propertyName, d.unitLabel, d.addressText].filter(Boolean).map(esc).join(', ');
  const sig = d.signature
    ? `<div class="signed">Electronically signed by ${esc(d.signature.name)} on ${fmtDate(d.signature.signedAt.slice(0, 10))}${d.signature.ip ? ` (IP ${esc(d.signature.ip)})` : ''}.</div>`
    : `<div class="sign-pending">Awaiting the tenant's electronic signature.</div>`;
  const isPdf = /\.pdf($|\?)/i.test(fileUrl);
  const attachment = isPdf
    ? `<iframe src="${esc(fileUrl)}" style="width:100%;height:78vh;border:1px solid #e5e7eb;border-radius:8px" title="Lease agreement"></iframe>`
    : `<img src="${esc(fileUrl)}" alt="Lease agreement" style="width:100%;border:1px solid #e5e7eb;border-radius:8px"/>`;
  const inner = `<h1>Lease schedule &mdash; ${esc(d.agencyName)}</h1>
    <table class="parties">
      <tr><td class="k">Landlord / Managing Agent</td><td>${esc(d.agencyName)}</td></tr>
      <tr><td class="k">Tenant</td><td>${esc(d.tenantName)}${d.tenantEmail ? `<br/>${esc(d.tenantEmail)}` : ''}</td></tr>
      <tr><td class="k">Leased premises</td><td>${premises || '—'}</td></tr>
      <tr><td class="k">Lease period</td><td>${fmtDate(d.startDate)} &ndash; ${d.endDate ? fmtDate(d.endDate) : 'month-to-month'}</td></tr>
      <tr><td class="k">Monthly rental</td><td>${money(d.rentAmount, cur)} per month</td></tr>
      <tr><td class="k">Deposit</td><td>${money(deposit, cur)}</td></tr>
    </table>
    <p class="muted">By signing, the Tenant agrees to the schedule above and to the attached lease agreement below.</p>
    ${attachment}
    <div class="signblock"><h2>Signature</h2>${sig}</div>`;
  return wrapHtml(inner, d.agencyName);
}

function wrapHtml(inner: string, title: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — Lease Agreement</title><style>${SHELL_CSS}</style></head><body>${inner}</body></html>`;
}

/**
 * Merge an agency's OWN lease template (plain text or HTML, with {{placeholders}})
 * with the deal specifics. Merged values are HTML-escaped; the template text
 * itself is trusted (agency-authored).
 */
export function mergeLeaseTemplate(template: string, d: LeaseAgreementData): string {
  const cur = d.currency ?? 'R';
  const deposit = d.depositAmount ?? d.rentAmount;
  const map: Record<string, string> = {
    agency_name: esc(d.agencyName), agency_email: esc(d.agencyEmail), agency_phone: esc(d.agencyPhone),
    tenant_name: esc(d.tenantName), tenant_email: esc(d.tenantEmail), tenant_id_number: esc(d.tenantIdNumber),
    property: esc(d.propertyName), unit: esc(d.unitLabel), address: esc(d.addressText),
    rent: money(d.rentAmount, cur), deposit: money(deposit, cur),
    start_date: fmtDate(d.startDate), end_date: d.endDate ? fmtDate(d.endDate) : 'month-to-month',
    today: fmtDate(d.generatedOn ?? new Date().toISOString().slice(0, 10)),
  };
  const sig = d.signature
    ? `<div class="signed">Electronically signed by ${esc(d.signature.name)} on ${fmtDate(d.signature.signedAt.slice(0, 10))}${d.signature.ip ? ` (IP ${esc(d.signature.ip)})` : ''}.</div>`
    : `<div class="sign-pending">Awaiting the tenant's electronic signature.</div>`;

  const hasSigToken = /\{\{\s*signature\s*\}\}/i.test(template);
  let merged = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
    const k = String(key).toLowerCase();
    if (k === 'signature') return sig;
    return k in map ? map[k] : m;
  });

  const looksHtml = /<[a-z][\s\S]*>/i.test(template);
  if (/<html[\s>]/i.test(template) || /<!doctype/i.test(template)) return merged; // already a full doc
  const content = looksHtml ? merged : `<pre class="plain">${merged}</pre>`;
  return wrapHtml(hasSigToken ? content : `${content}<div class="signblock">${sig}</div>`, d.agencyName);
}

export function renderLeaseAgreement(d: LeaseAgreementData): string {
  const cur = d.currency ?? 'R';
  const deposit = d.depositAmount ?? d.rentAmount;
  const premises = [d.propertyName, d.unitLabel, d.addressText].filter(Boolean).map(esc).join(', ');

  const clause = (n: number, title: string, body: string) =>
    `<section><h2>${n}. ${esc(title)}</h2>${body}</section>`;

  const signatureBlock = d.signature
    ? `<div class="signed">
         <p><strong>Electronically signed</strong> by ${esc(d.signature.name)} on ${fmtDate(d.signature.signedAt.slice(0, 10))}${d.signature.ip ? ` (IP ${esc(d.signature.ip)})` : ''}.</p>
         <p class="muted">Signed via ${esc(d.agencyName)} using the platform's electronic-signature process (ECTA, Act 25 of 2002).</p>
       </div>`
    : `<div class="sign-pending"><p class="muted">Awaiting the tenant's electronic signature.</p></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Residential Lease Agreement</title>
<style>
  :root{ --ink:#1a1c22; --muted:#6b7280; --line:#e5e7eb; }
  *{box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);line-height:1.55;margin:0;padding:28px;max-width:820px;margin:0 auto;font-size:14.5px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:var(--muted);font-size:13px;margin-bottom:20px}
  .draft{display:inline-block;background:#FEF3C7;color:#92400e;border:1px solid #FCD34D;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px}
  table.parties{width:100%;border-collapse:collapse;margin:0 0 18px}
  table.parties td{border:1px solid var(--line);padding:8px 10px;vertical-align:top;font-size:13.5px}
  table.parties td.k{width:34%;color:var(--muted);background:#fafafa}
  h2{font-size:15px;margin:20px 0 6px}
  section p{margin:6px 0}
  ul{margin:6px 0 6px 18px;padding:0}
  li{margin:3px 0}
  .muted{color:var(--muted)}
  .signblock{margin-top:26px;border-top:1px solid var(--line);padding-top:16px}
  .signed{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px}
  .sign-pending{background:#f9fafb;border:1px dashed var(--line);border-radius:8px;padding:12px 14px}
  footer{margin-top:24px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
</style></head>
<body>
  <span class="draft">Draft · for legal review</span>
  <h1>Residential Lease Agreement</h1>
  <div class="sub">Prepared by ${esc(d.agencyName)}${d.generatedOn ? ` · ${fmtDate(d.generatedOn)}` : ''}</div>

  <table class="parties">
    <tr><td class="k">Landlord / Managing Agent</td><td>${esc(d.agencyName)}${d.agencyEmail ? `<br/>${esc(d.agencyEmail)}` : ''}${d.agencyPhone ? `<br/>${esc(d.agencyPhone)}` : ''}</td></tr>
    <tr><td class="k">Tenant</td><td>${esc(d.tenantName)}${d.tenantIdNumber ? `<br/>ID/Passport: ${esc(d.tenantIdNumber)}` : ''}${d.tenantEmail ? `<br/>${esc(d.tenantEmail)}` : ''}</td></tr>
    <tr><td class="k">Leased premises</td><td>${premises || '—'}</td></tr>
    <tr><td class="k">Lease period</td><td>${fmtDate(d.startDate)} &ndash; ${d.endDate ? fmtDate(d.endDate) : 'month-to-month until terminated on notice'}</td></tr>
    <tr><td class="k">Monthly rental</td><td>${money(d.rentAmount, cur)} per month</td></tr>
    <tr><td class="k">Deposit</td><td>${money(deposit, cur)}</td></tr>
  </table>

  ${clause(1, 'Parties and premises', `<p>The Landlord/Managing Agent lets, and the Tenant hires, the residential premises described above (&ldquo;the Premises&rdquo;) on the terms set out in this agreement.</p>`)}
  ${clause(2, 'Lease period', `<p>The lease commences on ${fmtDate(d.startDate)}${d.endDate ? ` and terminates on ${fmtDate(d.endDate)}` : ' and continues on a month-to-month basis'}. Either party may terminate a periodic (month-to-month) lease on not less than one calendar month's written notice, and a fixed-term lease as provided by the Consumer Protection Act (20 business days' notice) and the Rental Housing Act, 1999.</p>`)}
  ${clause(3, 'Rental and payment', `<p>The Tenant shall pay ${money(d.rentAmount, cur)} per month in advance, on or before the first day of each month, without deduction or set-off, to the account nominated by the Landlord/Managing Agent. Rent not received by the due date is in arrears and may attract interest and reasonable collection costs.</p>`)}
  ${clause(4, 'Deposit', `<p>The Tenant shall pay a deposit of ${money(deposit, cur)}, to be held in an interest-bearing trust account in terms of the Rental Housing Act. The deposit, together with interest and less any amounts lawfully due (arrear rent, damage beyond fair wear and tear, and outstanding charges), is refundable after the joint outgoing inspection and vacation of the Premises.</p>`)}
  ${clause(5, 'Use of the premises', `<p>The Premises shall be used for residential purposes only, by the Tenant and their immediate household. No business may be conducted, and the Premises may not be sublet or occupation ceded, without the Landlord's prior written consent.</p>`)}
  ${clause(6, 'Utilities and charges', `<p>Unless otherwise agreed in writing, the Tenant is responsible for water, electricity, refuse and any metered services consumed at the Premises for the duration of occupation.</p>`)}
  ${clause(7, 'Maintenance and condition', `<p>The Tenant shall keep the Premises clean and in good order and report defects promptly. The Tenant is liable for damage caused by the Tenant or their visitors beyond fair wear and tear. The Landlord is responsible for structural maintenance and for keeping the Premises in a habitable condition. An incoming and outgoing inspection shall be conducted jointly.</p>`)}
  ${clause(8, 'Tenant obligations', `<ul>
      <li>Pay rent and all agreed charges on time.</li>
      <li>Comply with all applicable by-laws, body-corporate / house rules and reasonable directions.</li>
      <li>Not cause a nuisance or disturbance to neighbours.</li>
      <li>Not make alterations to the Premises without written consent.</li>
      <li>Allow the Landlord reasonable access on notice for inspection and repairs.</li>
    </ul>`)}
  ${clause(9, 'Breach', `<p>Should the Tenant breach any term and fail to remedy it within 20 business days of written notice, the Landlord may cancel this lease and pursue any remedy in law, including claiming arrear rental, damages and costs, without prejudice to other rights.</p>`)}
  ${clause(10, 'Protection of personal information', `<p>The Tenant consents to the Landlord/Managing Agent processing their personal information for purposes of this lease, affordability and credit assessment, and legal compliance, in accordance with the Protection of Personal Information Act, 2013 (POPIA).</p>`)}
  ${clause(11, 'Domicilium and notices', `<p>The parties choose the addresses above as their domicilium citandi et executandi for the service of notices. Notices may be given in writing, including by email to the addresses above.</p>`)}
  ${clause(12, 'Whole agreement', `<p>This document constitutes the whole agreement. No variation is of force unless reduced to writing and agreed by both parties. Any indulgence shall not constitute a waiver.</p>`)}

  <div class="signblock">
    <h2>Signature</h2>
    <p class="muted">By signing electronically, the Tenant confirms they have read, understood and agree to be bound by this agreement.</p>
    ${signatureBlock}
  </div>

  <footer>This is a computer-generated starter template provided by ${esc(d.agencyName)} via its property management platform. It is not legal advice; please have it reviewed and adapted to your circumstances before use.</footer>
</body></html>`;
}
