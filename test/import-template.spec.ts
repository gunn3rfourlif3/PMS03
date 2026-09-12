import { templateCsv, templateXlsx } from '../src/modules/imports/import-template';
import { ENTITIES, entitySpec } from '../src/modules/imports/import-fields';
import { readImportFile } from '../src/modules/imports/import-reader';
import { suggestMapping } from '../src/modules/imports/import-fields';

describe('templates', () => {
  it('round-trips: a template we generate maps perfectly back onto its own fields', () => {
    // The property that matters. A template that describes columns the importer
    // cannot recognise is worse than no template, and generating both from the
    // same field definitions is what prevents it.
    for (const spec of ENTITIES) {
      const [headerLine] = templateCsv(spec).split('\n');
      const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, '').replace(/""/g, '"'));
      const mapped = suggestMapping(headers, spec);
      expect(Object.values(mapped)).toEqual(spec.fields.map((f) => f.key));
    }
  });

  it('marks required columns with an asterisk', () => {
    const csv = templateCsv(entitySpec('leases'));
    expect(csv).toContain('Property name *');
    expect(csv).toContain('Escalation %');
    expect(csv).not.toContain('Escalation % *');
  });

  it('quotes only what needs quoting', () => {
    // None of the real examples contain a comma, so assert the rule directly
    // rather than against a value that happens not to exercise it.
    const spec = {
      ...entitySpec('owners'),
      fields: [
        { key: 'a', label: 'Plain', type: 'text' as const, required: true, example: 'Grove Court', aliases: [] },
        { key: 'b', label: 'With, comma', type: 'text' as const, required: false, example: 'Block A, Unit 2', aliases: [] },
      ],
    };
    const [head, example] = templateCsv(spec).split('\n');
    expect(head).toBe('Plain *,"With, comma"');
    expect(example).toBe('Grove Court,"Block A, Unit 2"');
  });

  it('produces a workbook our own reader can read back', async () => {
    const spec = entitySpec('units');
    const buf = await templateXlsx(spec);
    const sheets = await readImportFile('units.xlsx', buf);
    const data = sheets.find((s) => s.name !== 'How to fill this in')!;
    expect(Object.values(suggestMapping(data.headers, spec))).toEqual(spec.fields.map((f) => f.key));
    expect(data.rows[0][1]).toBe('007');   // the example survives as text
  });

  it('warns on the face of the file when an import moves money', async () => {
    const buf = await templateXlsx(entitySpec('opening_balances'));
    const sheets = await readImportFile('ob.xlsx', buf);
    const help = sheets.find((s) => s.name === 'How to fill this in')!;
    const text = JSON.stringify(help.rows);
    expect(text).toContain('THIS FILE MOVES MONEY');
  });

  it('does not warn about money on a file that cannot post', async () => {
    const buf = await templateXlsx(entitySpec('properties'));
    const sheets = await readImportFile('p.xlsx', buf);
    const help = sheets.find((s) => s.name === 'How to fill this in')!;
    expect(JSON.stringify(help.rows)).not.toContain('MOVES MONEY');
  });
});

describe('the instructions sheet speaks to a person, not a developer', () => {
  it('never prints an internal field name', async () => {
    // The first template shipped saying rows were matched on
    // "propertyName + unitLabel + startDate", which means nothing to whoever
    // is filling the file in.
    for (const spec of ENTITIES) {
      const sheets = await readImportFile('t.xlsx', await templateXlsx(spec));
      const help = JSON.stringify(sheets.find((s) => s.name === 'How to fill this in')!.rows);
      // Only camelCase keys — a one-word key like `name` is also an ordinary
      // English word and appears legitimately inside "Owner name".
      for (const f of spec.fields.filter((x) => /[a-z][A-Z]/.test(x.key))) {
        expect(help).not.toContain(f.key);
      }
      expect(help).toContain(spec.fields.find((f) => f.key === spec.naturalKey[0])!.label);
    }
  });

  it('calls a percentage a percentage, not an amount', async () => {
    const sheets = await readImportFile('l.xlsx', await templateXlsx(entitySpec('leases')));
    const rows = sheets.find((s) => s.name === 'How to fill this in')!.rows;
    const esc = rows.find((r) => r[0] === 'Escalation %')!;
    expect(esc[1]).toBe('percentage');
    const rent = rows.find((r) => r[0] === 'Rent')!;
    expect(rent[1]).toBe('amount');
  });
});
