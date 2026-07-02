import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EsignProvider, SignatureRequestInput, SignatureRequestResult,
} from './esign-provider.interface';

/**
 * Native/stub e-sign: mints a signing link + reference. Replace with DocuSign /
 * a regional provider; the callback maps back to our SignatureRequest by ref.
 */
@Injectable()
export class NativeEsignProvider implements EsignProvider {
  readonly name = 'native';
  private readonly base = process.env.ESIGN_BASE ?? 'http://localhost:3000/sign';

  async createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    const providerRef = `sig_${randomUUID()}`;
    return { providerRef, signUrl: `${this.base}/${providerRef}` };
  }
}
