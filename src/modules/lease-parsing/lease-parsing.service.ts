import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { MediaService, UploadedFileLike } from '@modules/media/media.service';
import { DOCUMENT_AI_PROVIDER, DocumentAiProvider, LeaseExtraction } from '@providers/document-ai/document-ai.interface';
import { LeaseExtractionRecord } from './lease-extraction.entity';

@Injectable()
export class LeaseParsingService {
  private readonly log = new Logger('LeaseParsing');

  constructor(
    private readonly tenant: TenantContextService,
    private readonly media: MediaService,
    @Inject(DOCUMENT_AI_PROVIDER) private readonly ai: DocumentAiProvider,
  ) {}

  /** Store the upload, extract text, run the AI extractor, and persist a record for review. */
  async parse(userId: string, file: UploadedFileLike): Promise<LeaseExtractionRecord> {
    const { url } = await this.media.saveProof(file); // pdf or image
    let extracted: LeaseExtraction = {};
    let status: 'parsed' | 'failed' = 'parsed';
    let error: string | undefined;

    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        throw new Error('No selectable text found — this looks like a scanned image. Upload a digital (text) PDF; OCR isn’t available in this version.');
      }
      extracted = await this.ai.extractLease(text);
    } catch (e: any) {
      status = 'failed';
      error = e.message;
      this.log.warn(`extraction failed: ${e.message}`);
    }

    const repo = this.tenant.getRepository(LeaseExtractionRecord);
    return repo.save(repo.create({
      vendorId: this.tenant.vendorId ?? undefined,
      sourceUrl: url,
      status,
      provider: this.ai.name,
      extracted: extracted as Record<string, unknown>,
      confidence: extracted.confidence,
      error,
      createdBy: userId,
    }));
  }

  async get(id: string): Promise<LeaseExtractionRecord> {
    const rec = await this.tenant.getRepository(LeaseExtractionRecord).findOne({ where: { id } });
    if (!rec) throw new NotFoundException('Extraction not found');
    return rec;
  }

  list(): Promise<LeaseExtractionRecord[]> {
    return this.tenant.getRepository(LeaseExtractionRecord).find({ order: { createdAt: 'DESC' }, take: 25 });
  }

  async markConfirmed(id: string): Promise<LeaseExtractionRecord> {
    const rec = await this.get(id);
    rec.status = 'confirmed';
    return this.tenant.getRepository(LeaseExtractionRecord).save(rec);
  }
}

/** Digital-PDF text extraction (pdf-parse). Images return empty (OCR is a later phase). */
async function extractPdfText(file: UploadedFileLike): Promise<string> {
  if (file.mimetype !== 'application/pdf') return '';
  // Required lazily so pdf-parse never runs its debug self-test at import time.
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(file.buffer);
  return data?.text ?? '';
}
