import * as ExcelJS from 'exceljs';
import { EntitySpec } from './import-fields';
import { ResolvedRow } from './import-resolve';
import { MoneyPlan } from './import-money';

/**
 * The schedule a principal signs before any money is posted.
 *
 * `LOCARE_DATA_IMPORT_DESIGN.md` §5: properties and leases can be corrected
 * with an edit, a posted ledger transaction cannot. So the figures go in front
 * of a human on paper first, and the fingerprint printed on the sheet is
 * checked again at commit — a signature can only ever authorise the numbers
 * that were actually in front of them.
 */

const R = (n: number) => `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function scheduleXlsx(
  spec: EntitySpec,
  rows: ResolvedRow[],
  plan: MoneyPlan,
  agencyName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Locare';
  wb.created = new Date();
  const ws = wb.addWorksheet(spec.entity === 'deposits' ? 'Deposits held' : 'Opening balances');

  const title = ws.addRow([`${agencyName} — ${spec.label}`]);
  title.font = { bold: true, size: 14 };
  ws.addRow([`Prepared ${new Date().toISOString().slice(0, 10)} for signature before posting`]);
  ws.addRow([`Reference: ${plan.digest}`]);
  ws.addRow([]);

  const isDeposits = spec.entity === 'deposits';
  const header = isDeposits
    ? ['Row', 'Property', 'Unit', 'Deposit', 'Interest', 'Total', 'Held by', 'Posts to trust?']
    : ['Row', 'Property', 'Unit', 'Amount owing', 'As at'];
  const head = ws.addRow(header);
  head.font = { bold: true };
  head.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } };
  });

  const acting = rows.filter((r) => r.action !== 'blocked' && r.action !== 'skip');
  for (const row of acting) {
    const v = row.values;
    if (isDeposits) {
      const amount = Number(v.amount ?? 0);
      const interest = Number(v.interestAccrued ?? 0);
      const trust = String(v.heldBy) === 'locare_trust';
      ws.addRow([
        row.rowNumber, v.propertyName, v.unitLabel,
        amount, interest, amount + interest,
        String(v.heldBy ?? '').replace(/_/g, ' '),
        trust ? 'YES' : 'no — held elsewhere',
      ]);
    } else {
      ws.addRow([row.rowNumber, v.propertyName, v.unitLabel, Number(v.balance ?? 0), String(v.asAt ?? '')]);
    }
  }

  ws.addRow([]);
  const totals = isDeposits
    ? [
      ['Deposits entering the Locare trust account', R(plan.totals.intoTrust)],
      ['Held by the landlord or a previous agent (recorded only)', R(plan.totals.heldElsewhere)],
    ]
    : [
      ['Total owed by tenants', R(plan.totals.owed)],
      ['Total in credit', R(plan.totals.credits)],
      ['Net posted to the ledger', R(plan.totals.owed - plan.totals.credits)],
    ];
  for (const [label, value] of totals) {
    const r = ws.addRow([label, '', '', value]);
    r.font = { bold: true };
  }

  const blocked = rows.filter((r) => r.action === 'blocked');
  if (blocked.length) {
    ws.addRow([]);
    const w = ws.addRow([`${blocked.length} row(s) could not be imported and are NOT included above:`]);
    w.font = { bold: true };
    for (const b of blocked) {
      ws.addRow([b.rowNumber, b.summary, b.issues.filter((i) => i.level === 'error').map((i) => i.message).join('; ')]);
    }
  }

  ws.addRow([]);
  ws.addRow(['I confirm the figures above are correct and authorise them to be posted.']);
  ws.addRow([]);
  ws.addRow(['Name', '', 'Signature', '', 'Date']);
  ws.addRow(['__________________', '', '__________________', '', '____________']);

  ws.columns.forEach((c, i) => { c.width = i === 0 ? 8 : i === 1 ? 32 : 18; });
  // Money columns as money, so nobody reads 9500 as nine thousand five hundred
  // and something.
  const moneyCols = isDeposits ? [4, 5, 6] : [4];
  for (const col of moneyCols) ws.getColumn(col).numFmt = '#,##0.00';

  return Buffer.from(await wb.xlsx.writeBuffer());
}
