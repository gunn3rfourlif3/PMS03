import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ValueTransformer } from 'typeorm';

/**
 * Application-level encryption for personal / financial information (POPIA
 * "appropriate, reasonable technical measures"). AES-256-GCM (authenticated)
 * with a key derived from PII_ENCRYPTION_KEY.
 *
 * Stored shape is a self-describing envelope kept in the existing jsonb column,
 * so no column-type migration is needed and legacy plaintext rows are still
 * readable (they're just re-encrypted next time they're saved).
 */
const logger = new Logger('PiiCrypto');
const SALT = 'pms.pii.v1';
let warned = false;

function key(): Buffer {
  const secret = process.env.PII_ENCRYPTION_KEY;
  if (!secret && !warned) {
    warned = true;
    logger.warn('PII_ENCRYPTION_KEY is not set — using an INSECURE development key. Set it before production.');
  }
  return scryptSync(secret || 'dev-insecure-pii-key', SALT, 32);
}

interface Envelope { __enc: 1; iv: string; tag: string; ct: string; }
const isEnvelope = (v: any): v is Envelope =>
  !!v && typeof v === 'object' && v.__enc === 1 && typeof v.ct === 'string';

export function encryptJson(value: unknown): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value ?? {}), 'utf8'), cipher.final()]);
  return { __enc: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

export function decryptJson<T = unknown>(env: Envelope): T {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(env.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(env.ct, 'base64')), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

/**
 * TypeORM transformer: encrypts a JSON value on write, decrypts on read.
 * Reads legacy plaintext transparently so existing rows keep working.
 */
export const encryptedJson: ValueTransformer = {
  to: (value: unknown) => (value == null ? {} : encryptJson(value)),
  from: (dbValue: unknown) => {
    if (isEnvelope(dbValue)) {
      try {
        return decryptJson(dbValue);
      } catch {
        logger.error('Failed to decrypt a PII field — is PII_ENCRYPTION_KEY correct?');
        throw new Error('PII decryption failed');
      }
    }
    return dbValue ?? {};
  },
};

const last4 = (s?: unknown) => (s ? String(s).slice(-4) : '');

/**
 * Redact a bank account number for bulk listing / display. Keeps other fields
 * (bank, holder, branch) but never returns the full account number.
 */
export function maskBanking(b: Record<string, any> | null | undefined): Record<string, unknown> {
  if (!b || !b.accountNumber) return b ?? {};
  return { ...b, accountNumber: '••••' + last4(b.accountNumber), accountNumberLast4: last4(b.accountNumber) };
}
