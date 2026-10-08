import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EsignProvider, SignatureRequestInput, SignatureRequestResult,
} from './esign-provider.interface';

/**
 * Print and sign — the mode A signature path
 * (docs/LOCARE_ONSITE_DEMO_BUILD_PLAN.md Day 5).
 *
 * With no published address there is nowhere for a tenant to click a signing
 * link, so the lease is printed, signed by hand and the countersigned scan is
 * uploaded back against the lease. That is how most of this market still signs a
 * lease, and option A costs the client nothing they are currently using.
 *
 * It implements `EsignProvider` rather than bypassing it, so nothing upstream
 * changes shape: `lease-agreement` still creates a request, still stores a ref,
 * still tracks sent and signed. Only the middle is different.
 *
 * `signUrl` is an INTERNAL back-office route, not a link anyone outside the
 * building can open — which is the entire point of the mode. Staff open it, it
 * renders the lease with a signature block, and they print it.
 *
 * Nothing here emails the tenant. There is no outbound mail path in a sealed
 * installation, and a provider that silently tried to send one would be the
 * exact failure the mode exists to prevent.
 */
@Injectable()
export class PrintSignEsignProvider implements EsignProvider {
  readonly name = 'print_sign';

  /** Internal only. Relative by design: it resolves against the host staff are already on. */
  private readonly base = process.env.PRINT_SIGN_BASE ?? '/leases/print';

  async createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
    // Same ref shape as the native provider, so the callback and lookup paths
    // that already exist keep working unchanged.
    const providerRef = `print_${randomUUID()}`;
    const doc = encodeURIComponent(input.documentKey ?? '');
    return {
      providerRef,
      signUrl: `${this.base}/${providerRef}?doc=${doc}`,
    };
  }
}
