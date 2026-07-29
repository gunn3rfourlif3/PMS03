/**
 * Pure move-in invoice: line builder + branded HTML renderer. No DB / I/O here,
 * so it's trivially testable. Sent to an approved applicant with the welcome
 * email. Covers first month's rent (prorated), an optional admin / lease fee,
 * and an optional refundable security deposit.
 */

export interface MoveInLine {
  label: string;
  amount: number;
}

export interface MoveInInvoiceInput {
  rent: number;          // first month's rent (already prorated by the caller)
  rentLabel: string;     // e.g. "Rent — 2026-08 (pro-rata 20/31 days)"
  adminFee?: number;
  deposit?: number;
}

export interface MoveInInvoiceData {
  invoiceNo: string;
  issuedOn: string;      // YYYY-MM-DD
  dueDate: string;       // YYYY-MM-DD
  startDate: string;     // lease start, YYYY-MM-DD
  agencyName: string;
  agencyEmail?: string;
  agencyPhone?: string;
  brandColor?: string;
  logoUrl?: string;
  tenantName: string;
  tenantEmail?: string;
  propertyName?: string;
  unitLabel?: string;
  addressText?: string;
  lines: MoveInLine[];
  total: number;
  depositIncluded: boolean;
  payUrl?: string;       // where the tenant signs in to pay
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Build the move-in line items, skipping any zero/absent charge. */
export function buildMoveInLines(input: MoveInInvoiceInput): { lines: MoveInLine[]; total: number } {
  const lines: MoveInLine[] = [{ label: input.rentLabel, amount: round2(input.rent) }];
  const admin = Number(input.adminFee) || 0;
  const deposit = Number(input.deposit) || 0;
  if (admin > 0) lines.push({ label: 'Admin / lease fee', amount: round2(admin) });
  if (deposit > 0) lines.push({ label: 'Security deposit (refundable)', amount: round2(deposit) });
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, total };
}

const zar = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(n) || 0);

const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render the branded move-in invoice as a standalone HTML document. */
export function renderMoveInInvoice(d: MoveInInvoiceData): string {
  const brand = d.brandColor || '#0F6E56';
  const rows = d.lines
    .map(
      (l) => `<tr>
        <td style="padding:12px 16px;border-top:1px solid #eee;color:#16181d">${esc(l.label)}</td>
        <td style="padding:12px 16px;border-top:1px solid #eee;text-align:right;color:#16181d;white-space:nowrap">${zar(l.amount)}</td>
      </tr>`,
    )
    .join('');

  const propertyLine = [d.unitLabel ? `Unit ${esc(d.unitLabel)}` : '', esc(d.propertyName)].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Move-in invoice ${esc(d.invoiceNo)}</title></head>
<body style="margin:0;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16181d">
  <div style="max-width:680px;margin:24px auto;background:#fff;border:1px solid #eaeaea;border-radius:16px;overflow:hidden">
    <div style="background:${brand};color:#fff;padding:24px 28px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:12px">
        ${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" width="40" height="40" style="border-radius:8px;object-fit:contain;background:#fff">` : ''}
        <div style="font-size:18px;font-weight:700">${esc(d.agencyName)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;opacity:.85">Move-in invoice</div>
        <div style="font-size:15px;font-weight:700">${esc(d.invoiceNo)}</div>
      </div>
    </div>

    <div style="padding:24px 28px">
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Billed to</div>
          <div style="font-weight:600;margin-top:4px">${esc(d.tenantName)}</div>
          ${d.tenantEmail ? `<div style="color:#6b7280;font-size:13px">${esc(d.tenantEmail)}</div>` : ''}
          ${propertyLine ? `<div style="color:#6b7280;font-size:13px;margin-top:4px">${propertyLine}</div>` : ''}
          ${d.addressText ? `<div style="color:#6b7280;font-size:13px">${esc(d.addressText)}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:13px;color:#6b7280">
          <div>Issued: <span style="color:#16181d">${esc(d.issuedOn)}</span></div>
          <div>Due: <span style="color:#16181d">${esc(d.dueDate)}</span></div>
          <div>Lease starts: <span style="color:#16181d">${esc(d.startDate)}</span></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#fafafa">
            <th style="text-align:left;padding:10px 16px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Description</th>
            <th style="text-align:right;padding:10px 16px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td style="padding:14px 16px;border-top:2px solid #eee;font-weight:700">Total due on move-in</td>
            <td style="padding:14px 16px;border-top:2px solid #eee;text-align:right;font-weight:700;color:${brand}">${zar(d.total)}</td>
          </tr>
        </tfoot>
      </table>

      ${d.depositIncluded ? `<p style="font-size:13px;color:#6b7280;margin-top:14px">The security deposit is refundable and held on your behalf, less any amounts lawfully due at the end of the lease.</p>` : ''}

      <div style="margin-top:20px;padding:16px;border:1px solid #eee;border-radius:12px;background:#fafafa">
        <div style="font-weight:600;margin-bottom:4px">How to pay</div>
        <div style="font-size:13px;color:#6b7280">
          ${d.payUrl ? `Sign in to your tenant portal to pay securely: <a href="${esc(d.payUrl)}" style="color:${brand}">${esc(d.payUrl)}</a>.` : 'Sign in to your tenant portal to pay securely.'}
        </div>
      </div>

      <div style="margin-top:22px;border-top:1px solid #eee;padding-top:14px;font-size:12px;color:#9ca3af">
        ${esc(d.agencyName)}${d.agencyEmail ? ` · ${esc(d.agencyEmail)}` : ''}${d.agencyPhone ? ` · ${esc(d.agencyPhone)}` : ''}
      </div>
    </div>
  </div>
</body></html>`;
}
