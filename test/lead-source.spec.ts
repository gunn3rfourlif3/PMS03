/**
 * "Where did you hear about us?" is self-reported acquisition data. Two things
 * have to hold: the API only accepts values it can group by, and a self-reported
 * "a Locare partner" never becomes commission attribution — that comes from a
 * referral code or a partner-created agency, and nothing else.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateLeadDto } from '@modules/leads/leads.dto';
import { StartApplicationDto } from '@modules/partner-applications/partner-applications.dto';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, sourceLabel } from '@common/lead-sources';

const errorsFor = async (cls: any, obj: Record<string, unknown>) =>
  (await validate(plainToInstance(cls, obj))).map((e) => e.property);

describe('lead source list', () => {
  it('labels every value, so nothing renders as a raw key', () => {
    for (const s of LEAD_SOURCES) expect(LEAD_SOURCE_LABELS[s]).toBeTruthy();
    expect(Object.keys(LEAD_SOURCE_LABELS).sort()).toEqual([...LEAD_SOURCES].sort());
  });

  it('renders a dash for an unanswered or unknown source', () => {
    expect(sourceLabel(null)).toBe('—');
    expect(sourceLabel(undefined)).toBe('—');
    expect(sourceLabel('')).toBe('—');
    expect(sourceLabel('myspace')).toBe('—');
  });
});

describe('CreateLeadDto.source', () => {
  const base = { name: 'Sam', email: 'sam@agency.co.za' };

  it.each(LEAD_SOURCES.map((s) => [s]))('accepts %s', async (source) => {
    expect(await errorsFor(CreateLeadDto, { ...base, source })).toEqual([]);
  });

  it('accepts an omitted source — the question is optional', async () => {
    expect(await errorsFor(CreateLeadDto, base)).toEqual([]);
  });

  // The form omits the field rather than posting "", because a blank would
  // fail this and lose an otherwise good lead at the last step.
  it.each([['empty string', ''], ['unknown value', 'tiktok'], ['injection-ish', "google'; drop--"]])(
    'rejects %s', async (_label, source) => {
      expect(await errorsFor(CreateLeadDto, { ...base, source })).toEqual(['source']);
    },
  );
});

describe('StartApplicationDto.source', () => {
  it('accepts a known source and omits cleanly', async () => {
    expect(await errorsFor(StartApplicationDto, { contactEmail: 'p@x.co.za', source: 'instagram' })).toEqual([]);
    expect(await errorsFor(StartApplicationDto, { contactEmail: 'p@x.co.za' })).toEqual([]);
  });

  it('rejects an unknown source', async () => {
    expect(await errorsFor(StartApplicationDto, { contactEmail: 'p@x.co.za', source: 'whatever' })).toEqual(['source']);
  });

  // Documented so it survives a future refactor: this field is marketing data,
  // not the commission basis.
  it('offers "partner" as a source without it meaning attribution', () => {
    expect(LEAD_SOURCES).toContain('partner');
    expect(LEAD_SOURCE_LABELS.partner).toBe('A Locare partner');
  });
});
