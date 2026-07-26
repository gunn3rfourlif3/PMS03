import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import sharp = require('sharp');
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', pdf: 'application/pdf',
  html: 'text/html',
};

/**
 * Real disk-backed file storage on a persistent volume. Images are written under
 * MEDIA_DIR and served publicly from GET /media/:key. Replaces the dev no-op
 * storage stub for the listing/inspection photo features.
 */
@Injectable()
export class MediaService {
  private readonly log = new Logger('Media');
  private readonly dir = process.env.MEDIA_DIR ?? '/data/media';
  private readonly base = (process.env.PUBLIC_API_BASE ?? '').replace(/\/+$/, '');

  constructor() {
    try { mkdirSync(this.dir, { recursive: true }); } catch (e: any) { this.log.error(`mkdir ${this.dir}: ${e.message}`); }
  }

  async save(file: UploadedFileLike): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    if (!file.mimetype?.startsWith('image/')) throw new BadRequestException('Only image files are allowed');

    const id = randomUUID();
    try {
      // Auto-orient, then emit a size-capped WebP + a square-ish thumbnail.
      const src = sharp(file.buffer, { failOn: 'none' }).rotate();
      const full = await src.clone().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const thumb = await src.clone().resize(500, 500, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      const key = `${id}.webp`;
      await Promise.all([
        writeFile(join(this.dir, key), full),
        writeFile(join(this.dir, `${id}_thumb.webp`), thumb),
      ]);
      return { key, url: this.url(key) };
    } catch (e: any) {
      // Unsupported/edge-case image — store the original bytes; the UI falls back
      // to the full image when a thumbnail is missing.
      this.log.warn(`image processing failed (${e.message}); storing original`);
      const ext = EXT_BY_MIME[file.mimetype] ?? 'jpg';
      const key = `${id}.${ext}`;
      await writeFile(join(this.dir, key), file.buffer);
      return { key, url: this.url(key) };
    }
  }

  /** Like save(), but also accepts a PDF (stored as-is; images still resized). */
  async saveProof(file: UploadedFileLike): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');
    if (file.mimetype?.startsWith('image/')) return this.save(file);
    if (file.mimetype === 'application/pdf') {
      const key = `${randomUUID()}.pdf`;
      await writeFile(join(this.dir, key), file.buffer);
      return { key, url: this.url(key) };
    }
    throw new BadRequestException('Upload an image or PDF');
  }

  /** Store a generated HTML document (e.g. a lease agreement) and return its URL. */
  async saveHtml(html: string): Promise<{ key: string; url: string }> {
    const key = `${randomUUID()}.html`;
    await writeFile(join(this.dir, key), Buffer.from(html, 'utf8'));
    return { key, url: this.url(key) };
  }

  url(key: string): string {
    return `${this.base}/media/${key}`;
  }

  /** Resolve a stored file for streaming, guarding against path traversal. */
  resolve(key: string): { path: string; contentType: string } {
    if (!/^[a-zA-Z0-9._-]+$/.test(key) || key.includes('..')) throw new NotFoundException('Not found');
    const path = normalize(join(this.dir, key));
    if (!path.startsWith(normalize(this.dir)) || !existsSync(path)) throw new NotFoundException('Not found');
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return { path, contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  }
}
