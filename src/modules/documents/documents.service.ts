import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
import { STORAGE_PROVIDER } from '@providers/storage/storage-provider.interface';
import type { StorageProvider } from '@providers/storage/storage-provider.interface';
import { Document, DocOwnerType } from './document.entity';
import { buildStorageKey, canAccess } from './storage-key';

export interface RequestUploadInput {
  ownerType: DocOwnerType;
  ownerId: string;
  type: string;
  filename: string;
  contentType: string;
  expiryDate?: string;
  accessRoles?: string[];
}

/**
 * Document metadata + presigned upload/download. Bytes never pass through the
 * API: clients PUT/GET directly to object storage using short-lived URLs.
 * Versioning is automatic per (ownerType, ownerId, type).
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenant: TenantContextService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  ping(): string {
    return 'Documents module ready';
  }

  async requestUpload(input: RequestUploadInput): Promise<{
    documentId: string;
    uploadUrl: string;
    storageKey: string;
    version: number;
  }> {
    const repo = this.tenant.getRepository(Document);
    const prior = await repo.count({
      where: { ownerType: input.ownerType, ownerId: input.ownerId, type: input.type },
    });
    const version = prior + 1;
    const vendorId = this.tenant.vendorId ?? '';
    const storageKey = buildStorageKey(
      vendorId, input.ownerType, input.ownerId, input.type, version, input.filename,
    );

    const { uploadUrl } = await this.storage.createUploadUrl({
      key: storageKey,
      contentType: input.contentType,
    });

    const doc = await repo.save(
      repo.create({
        vendorId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        type: input.type,
        storageKey,
        filename: input.filename,
        contentType: input.contentType,
        version,
        expiryDate: input.expiryDate,
        accessScope: { roles: input.accessRoles ?? [] },
        status: 'pending',
        uploadedBy: this.tenant.get()?.userId ?? undefined,
      }),
    );
    return { documentId: doc.id, uploadUrl, storageKey, version };
  }

  /** Mark a document stored once the client confirms the upload succeeded. */
  async confirmUpload(documentId: string): Promise<Document> {
    const repo = this.tenant.getRepository(Document);
    const doc = await repo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    doc.status = 'stored';
    return repo.save(doc);
  }

  /** Presigned download, gated by the document's access scope. */
  async getDownloadUrl(documentId: string, principalRoles: string[]): Promise<string> {
    const repo = this.tenant.getRepository(Document);
    const doc = await repo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!canAccess(doc.accessScope, principalRoles)) {
      throw new ForbiddenException('Not permitted to access this document');
    }
    return this.storage.createDownloadUrl(doc.storageKey);
  }

  listForEntity(ownerType: DocOwnerType, ownerId: string): Promise<Document[]> {
    return this.tenant
      .getRepository(Document)
      .find({ where: { ownerType, ownerId }, order: { version: 'DESC' } });
  }
}
