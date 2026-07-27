import { Injectable } from '@nestjs/common';
import { DocumentAiProvider, LeaseExtraction, sanitizeExtraction } from './document-ai.interface';

/**
 * Zero-dependency heuristic extractor (regex). Default provider so the feature
 * works in dev/CI without any API key. Lower confidence than an LLM; swap to the
 * Anthropic provider (DOCUMENT_AI_PROVIDER=anthropic) for real accuracy.
 */
@Injectable()
export class HeuristicDocumentAiProvider implements DocumentAiProvider {
  readonly name = 'heuristic';

  async extractLease(raw: string): Promise<LeaseExtraction> {
    const t = raw.replace(/\r/g, ' ').replace(/ /g, ' ');
    const amount = (re: RegExp) => t.match(re)?.[1]?.replace(/[\s,]/g, '');
    const dateNear = (re: RegExp) => t.match(re)?.[1];

    const e: LeaseExtraction = {
      tenantName: t.match(/(?:tenant|lessee|occupant)\s*[:\-]?\s*([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,3})/)?.[1]?.trim(),
      tenantEmail: t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0],
      tenantPhone: t.match(/(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/)?.[0]?.replace(/\s+/g, ''),
      tenantIdNumber: t.match(/\b(\d{13})\b/)?.[1],
      startDate: dateNear(/(?:commenc\w*|start\w*|from|effective)[^\n]{0,40}?(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i),
      endDate: dateNear(/(?:end\w*|until|expir\w*|terminat\w*|to)[^\n]{0,40}?(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i),
      monthlyRent: Number(amount(/(?:monthly\s+rent|rent(?:al)?)[^\n]{0,40}?R\s?([\d\s,]+(?:\.\d{2})?)/i)) || undefined,
      deposit: Number(amount(/deposit[^\n]{0,40}?R\s?([\d\s,]+(?:\.\d{2})?)/i)) || undefined,
      currency: 'ZAR',
      dueDay: Number(t.match(/due[^\n]{0,20}?(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i)?.[1]) || undefined,
      escalationPct: Number(t.match(/escalat\w*[^\n]{0,30}?(\d{1,2}(?:\.\d+)?)\s?%/i)?.[1]) || undefined,
      leaseType: /month\s*[- ]?to\s*[- ]?month|periodic/i.test(t) ? 'periodic' : 'fixed',
      utilitiesIncluded: ['water', 'electricity', 'refuse', 'internet'].filter((u) => new RegExp(`${u}[^\\n]{0,30}?includ`, 'i').test(t)),
      flaggedClauses: [],
      confidence: 0.4,
    };
    return sanitizeExtraction(e);
  }
}
