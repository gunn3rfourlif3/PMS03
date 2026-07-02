/**
 * E-signature abstraction (DocuSign / native / regional). Webhook-driven: we
 * create a request, the provider hosts signing, and a callback reports the
 * outcome. Providers are swappable behind this interface.
 */
export interface SignatureRequestInput {
  documentKey: string;    // storage key of the doc to sign
  signerEmail: string;
  signerName?: string;
  subject?: string;
}

export interface SignatureRequestResult {
  providerRef: string;
  signUrl: string;
}

export interface EsignProvider {
  readonly name: string;
  createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult>;
}

export const ESIGN_PROVIDER = Symbol('ESIGN_PROVIDER');
