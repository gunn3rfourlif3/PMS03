import { AnthropicDocumentAiProvider } from '../src/providers/document-ai/anthropic.provider';
import { normalizeDate, sanitizeExtraction } from '../src/providers/document-ai/document-ai.interface';

const toolResponse = (input: any) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ content: [{ type: 'tool_use', name: 'record_lease', input }] }),
  text: async () => '',
});
const errResponse = (status: number, bodyText = '') => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({}),
  text: async () => bodyText,
});
const okBase = { currency: 'ZAR', utilitiesIncluded: [], flaggedClauses: [], confidence: 0.6 };

describe('sanitizeExtraction / normalizeDate', () => {
  it('normalises SA DD/MM/YYYY and ISO, rejects impossible months', () => {
    expect(normalizeDate('01/03/2026')).toBe('2026-03-01');
    expect(normalizeDate('2026-03-01')).toBe('2026-03-01');
    expect(normalizeDate('31/13/2026')).toBeUndefined();
  });
  it('coerces messy numbers, clamps due-day, drops end<=start, defaults currency', () => {
    const out = sanitizeExtraction({
      monthlyRent: 'R 9 500' as any, deposit: '9500' as any, dueDay: 40,
      startDate: '2026-03-01', endDate: '2026-02-01',
    });
    expect(out.monthlyRent).toBe(9500);
    expect(out.deposit).toBe(9500);
    expect(out.dueDay).toBe(31);
    expect(out.endDate).toBeUndefined();
    expect(out.currency).toBe('ZAR');
    expect(out.utilitiesIncluded).toEqual([]);
  });
});

describe('AnthropicDocumentAiProvider', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD, ANTHROPIC_API_KEY: 'k', DOCUMENT_AI_MAX_RETRIES: '2' }; });
  afterEach(() => { process.env = OLD; (global as any).fetch = undefined; jest.restoreAllMocks(); });

  it('extracts via forced tool use in one call', async () => {
    const f = jest.fn().mockResolvedValue(toolResponse({ ...okBase, tenantName: 'Jane', monthlyRent: 9500, confidence: 0.9 }));
    (global as any).fetch = f;
    const r = await new AnthropicDocumentAiProvider().extractLease('lease text');
    expect(r.tenantName).toBe('Jane');
    expect(r.monthlyRent).toBe(9500);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries a transient 529 then succeeds', async () => {
    const f = jest.fn()
      .mockResolvedValueOnce(errResponse(529, 'overloaded'))
      .mockResolvedValueOnce(toolResponse(okBase));
    (global as any).fetch = f;
    const r = await new AnthropicDocumentAiProvider().extractLease('x');
    expect(r.currency).toBe('ZAR');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('classifies a 401 as an API-key problem and does not retry', async () => {
    const f = jest.fn().mockResolvedValue(errResponse(401, 'unauthorized'));
    (global as any).fetch = f;
    await expect(new AnthropicDocumentAiProvider().extractLease('x')).rejects.toThrow(/API key/i);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('falls back to JSON embedded in a text response', async () => {
    const payload = { content: [{ type: 'text', text: `ok: ${JSON.stringify({ ...okBase, monthlyRent: 8000 })}` }] };
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, json: async () => payload, text: async () => '' });
    const r = await new AnthropicDocumentAiProvider().extractLease('x');
    expect(r.monthlyRent).toBe(8000);
  });
});
