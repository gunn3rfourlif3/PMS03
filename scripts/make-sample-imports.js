/**
 * Sample import files for testing the agency data importer.
 *
 *   node scripts/make-sample-imports.js <output-directory>
 *
 * Deliberately NOT written with Locare's own column labels. A real agency
 * arrives with a sheet shaped by whatever they used before, so these use the
 * words an SA letting agency actually uses — "Landlord", "Flat No", "Held With"
 * — which is what exercises the alias matching rather than the happy path.
 *
 * Emails use the .invalid TLD (RFC 2606) so nothing can ever reach a real
 * inbox, the same choice deploy/seed-demo-agencies.sql makes.
 */
const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');

const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });

const D = (iso) => new Date(`${iso}T00:00:00Z`);

async function xlsx(file, sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Locare sample generator';
  for (const [name, rows] of sheets) {
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => { c.width = 22; });
  }
  const p = path.join(out, file);
  await wb.xlsx.writeFile(p);
  console.log('wrote', p);
}

function csv(file, rows) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const p = path.join(out, file);
  fs.writeFileSync(p, `${body}\n`, 'utf8');
  console.log('wrote', p);
}

// ── The portfolio ───────────────────────────────────────────────────────────
const OWNERS = [
  ['Landlord', 'Email Address', 'Cell', 'Commission %'],
  ['M & J Property Trust', 'accounts@mjtrust.invalid', '0821234567', 8.5],
  ['Sipho Dlamini', 'sipho.dlamini@demo.invalid', '0836549871', 7],
  ['Rosebank Holdings (Pty) Ltd', 'admin@rosebankholdings.invalid', '0114567890', 10],
];

const PROPERTIES = [
  ['Building', 'Owner', 'Street Address', 'Suburb', 'Town', 'Postcode'],
  ['Grove Court', 'M & J Property Trust', '14 Grove Road', 'Claremont', 'Cape Town', '7708'],
  ['Acacia Mews', 'Sipho Dlamini', '88 Acacia Street', 'Northcliff', 'Johannesburg', '2195'],
  ['Rosebank Heights', 'Rosebank Holdings (Pty) Ltd', '5 Sturdee Avenue', 'Rosebank', 'Johannesburg', '2196'],
];

// '007' stays text on purpose: a unit number that becomes the number 7 is the
// oldest spreadsheet bug in property management.
const UNITS = [
  ['Complex', 'Flat No', 'Rental', 'Beds', 'Baths'],
  ['Grove Court', '007', 9500, 2, 1],
  ['Grove Court', '008', 9800, 2, 1],
  ['Grove Court', '012', 11500, 3, 2],
  ['Acacia Mews', 'A1', 7200, 1, 1],
  ['Acacia Mews', 'A2', 7200, 1, 1],
  ['Acacia Mews', 'B4', 8400, 2, 1],
  ['Rosebank Heights', '301', 15500, 2, 2],
  ['Rosebank Heights', '402', 18900, 3, 2],
];

const TENANTS = [
  ['Tenant', 'Email', 'Mobile'],
  ['Thandi Mokoena', 'thandi.mokoena@demo.invalid', '0821110001'],
  ['Pieter van Wyk', 'pieter.vanwyk@demo.invalid', '0821110002'],
  ['Nomsa Khumalo', 'nomsa.khumalo@demo.invalid', '0821110003'],
  ['Rajesh Naidoo', 'rajesh.naidoo@demo.invalid', '0821110004'],
  ['Lerato Mahlangu', 'lerato.mahlangu@demo.invalid', '0821110005'],
  ['Grant Fourie', 'grant.fourie@demo.invalid', '0821110006'],
];

// Real Date cells, not text — that is what an .xlsx from an agency contains,
// and it is the path worth testing. Grove Court 008 has already expired, so it
// should import as `ended` rather than start invoicing someone who moved out.
const LEASES = [
  ['Property', 'Unit', 'Tenant Email', 'Lessee', 'Commencement', 'Expiry', 'Monthly Rent', 'Lease Type', 'Escalation', 'Review Month'],
  ['Grove Court', '007', 'thandi.mokoena@demo.invalid', 'Thandi Mokoena', D('2026-03-01'), D('2027-02-28'), 9500, 'fixed', 7, 3],
  ['Grove Court', '008', 'pieter.vanwyk@demo.invalid', 'Pieter van Wyk', D('2025-08-01'), D('2026-07-31'), 9800, 'fixed', 7, 8],
  ['Acacia Mews', 'A1', 'nomsa.khumalo@demo.invalid', 'Nomsa Khumalo', D('2026-01-15'), null, 7200, 'month_to_month', null, null],
  ['Acacia Mews', 'B4', 'rajesh.naidoo@demo.invalid', 'Rajesh Naidoo', D('2026-05-01'), D('2027-04-30'), 8400, 'fixed', 8, 5],
  ['Rosebank Heights', '301', 'lerato.mahlangu@demo.invalid', 'Lerato Mahlangu', D('2025-11-01'), D('2026-10-31'), 15500, 'fixed', 7, 11],
  ['Rosebank Heights', '402', 'grant.fourie@demo.invalid', 'Grant Fourie', D('2026-06-01'), D('2027-05-31'), 18900, 'fixed', 6, 6],
];

// Three in the Locare trust account, two held elsewhere. Only the first three
// should post; the other two are recorded and shown, never booked as trust cash.
//   into trust     9 912.30 + 8 400.00 + 19 150.00 = 37 462.30
//   held elsewhere 7 200.00 + 15 500.00            = 22 700.00
const DEPOSITS = [
  ['Property', 'Unit', 'Deposit Held', 'Held With', 'Interest'],
  ['Grove Court', '007', 9500, 'locare_trust', 412.30],
  ['Acacia Mews', 'A1', 7200, 'landlord', 0],
  ['Acacia Mews', 'B4', 8400, 'locare_trust', 0],
  ['Rosebank Heights', '301', 15500, 'previous_agent', 0],
  ['Rosebank Heights', '402', 18900, 'locare_trust', 250],
];

// One tenant in credit, and one balance struck three months back so it lands in
// an older ageing bucket rather than 0-30.
//   owed 18 500 + 6 400 = 24 900 · credits 1 250 · net posted 23 650
const BALANCES = [
  ['Property', 'Unit', 'Arrears', 'As At'],
  ['Grove Court', '007', 18500, D('2026-08-31')],
  ['Acacia Mews', 'A1', -1250, D('2026-08-31')],
  ['Rosebank Heights', '301', 6400, D('2026-06-30')],
];

// ── Files that should FAIL, each for one reason ─────────────────────────────
const UNITS_MESSY = [
  ['Complex', 'Flat No', 'Rental', 'Beds', 'Baths'],
  ['Grove Court', '015', 8900, 2, 1],                 // fine
  ['Grove Kort', '016', 9000, 2, 1],                  // no such property
  ['Grove Court', '', 9000, 2, 1],                    // no unit number
  ['Grove Court', '017', 'nine thousand', 2, 1],      // rent is not a number
];

const LEASES_BAD = [
  ['Property', 'Unit', 'Tenant Email', 'Commencement', 'Monthly Rent'],
  ['Grove Court', '012', 'zanele.dube@demo.invalid', D('2026-09-01'), 11500], // tenant not imported
  ['Grove Court', '012', 'thandi.mokoena@demo.invalid', '03/04/2026', 11500], // ambiguous date
];

(async () => {
  await xlsx('01-owners.xlsx', [['Owners', OWNERS]]);
  await xlsx('02-properties.xlsx', [['Properties', PROPERTIES]]);
  // Two sheets, so the sheet chooser has something to choose. The data sheet is
  // second and larger — the importer should land on it by itself.
  await xlsx('03-units.xlsx', [
    ['Notes', [['Prepared by the agency'], ['Rents exclude utilities']]],
    ['Units', UNITS],
  ]);
  await xlsx('04-tenants.xlsx', [['Tenants', TENANTS]]);
  await xlsx('05-leases.xlsx', [['Leases', LEASES]]);
  await xlsx('06-deposits.xlsx', [['Deposits', DEPOSITS]]);
  await xlsx('07-opening-balances.xlsx', [['Balances', BALANCES]]);
  await xlsx('08-units-with-errors.xlsx', [['Units', UNITS_MESSY]]);
  await xlsx('09-leases-with-errors.xlsx', [['Leases', LEASES_BAD]]);
  csv('01-owners.csv', OWNERS);
})();
