import { Injectable } from '@nestjs/common';
import { StorageProvider, UploadUrlRequest } from './storage-provider.interface';

/**
 * Dev-only stub: returns local pseudo-URLs so the flow works without S3 creds.
 * Never use in production — no real bytes are stored.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly base = process.env.LOCAL_STORAGE_BASE ?? 'http://localhost:3000/dev-storage';

  async createUploadUrl(req: UploadUrlRequest): Promise<{ uploadUrl: string; key: string }> {
    return { uploadUrl: `${this.base}/${req.key}?upload=1`, key: req.key };
  }

  async createDownloadUrl(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }
}
