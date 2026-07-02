import { Injectable } from '@nestjs/common';
import { StorageProvider, UploadUrlRequest } from './storage-provider.interface';

/**
 * S3-compatible provider (AWS S3 / Cloudflare R2 / Hetzner Object Storage).
 *
 * Wire with @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner:
 *   const client = new S3Client({ endpoint: S3_ENDPOINT, region, credentials });
 *   getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn });
 *
 * Left as a thin stub returning endpoint-shaped URLs so the module compiles and
 * runs before SDK creds are configured; replace the two bodies to go live.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly endpoint = process.env.S3_ENDPOINT ?? '';
  private readonly bucket = process.env.S3_BUCKET ?? 'pms-documents';

  async createUploadUrl(req: UploadUrlRequest): Promise<{ uploadUrl: string; key: string }> {
    // TODO: getSignedUrl(PutObjectCommand). Placeholder URL for now.
    return { uploadUrl: `${this.endpoint}/${this.bucket}/${req.key}?presigned=put`, key: req.key };
  }

  async createDownloadUrl(key: string): Promise<string> {
    // TODO: getSignedUrl(GetObjectCommand).
    return `${this.endpoint}/${this.bucket}/${key}?presigned=get`;
  }
}
