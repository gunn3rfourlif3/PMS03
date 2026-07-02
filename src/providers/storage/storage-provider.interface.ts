/**
 * Object-storage abstraction (S3-compatible). The app never streams file bytes
 * through itself — it issues presigned URLs so clients upload/download directly
 * to storage (R2 / Hetzner / S3). Swap providers per environment.
 */
export interface UploadUrlRequest {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface StorageProvider {
  readonly name: string;
  createUploadUrl(req: UploadUrlRequest): Promise<{ uploadUrl: string; key: string }>;
  createDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
