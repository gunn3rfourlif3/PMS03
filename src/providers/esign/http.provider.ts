import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EsignProvider, SignatureRequestInput, SignatureRequestResult,
} from './esign-provider.interface';

/**
 * Generic HTTP e-sign provider. Gated on ESIGN_API_URL + ESIGN_API_KEY; posts a
 * signature request and expects { providerRef, signUrl } back. Works with any
 * REST e-sign vendor (or an internal signing service). Falls back to a minted
 * link if the call fails, so a document is never left un-actionable.
 */
@Injectable()
export class HttpEsignProvider implements EsignProvider {
  readonly name = 'http';
  private readonly logger = new Logger('Esign:http');
  private readonly url = process.env.ESIGN_API_URL!;
  private readonly key = process.env.ESIGN_API_KEY ?? '';

  async createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.signUrl) throw new Error(json?.message ?? `esign ${res.status}`);
      return { providerRef: json.providerRef ?? `sig_${randomUUID()}`, signUrl: json.signUrl };
    } catch (e: any) {
      this.logger.error(`createSignatureRequest failed: ${e.message}`);
      const providerRef = `sig_${randomUUID()}`;
      const base = process.env.ESIGN_BASE ?? 'http://localhost:3000/sign';
      return { providerRef, signUrl: `${base}/${providerRef}` };
    }
  }
}
