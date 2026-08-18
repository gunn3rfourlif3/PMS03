import { Body, Controller, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { verifySvixSignature } from '@providers/payment/svix-verify';
import { isConsentWebhook, parseConsentWebhook } from './consent-webhook';
import { MandatesService } from './mandates.service';

@Controller('debicheck')
export class DebiCheckController {
  private readonly log = new Logger('DebiCheckWebhook');

  constructor(private readonly mandates: MandatesService) {}

  /**
   * Stitch `payment-consent-request` webhook — mandate lifecycle.
   *
   * Its own endpoint rather than a branch on the payments webhook: mandates and
   * payments are separate subscriptions at Stitch and separate modules here, and
   * a mandate revocation arriving on the payments path would be one more thing
   * to disambiguate under time pressure.
   *
   * Signature verification is shared with the payment webhooks (Svix), but the
   * signing secret is per-subscription, so this has its own.
   *
   * Always 200 after a valid signature, including for events that change
   * nothing — a non-200 makes Svix retry, and retrying something we understood
   * and chose not to act on is noise.
   */
  @Post('webhook/consent')
  async consent(@Req() req: RawBodyRequest<Request>, @Body() body: any) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});

    const verdict = verifySvixSignature({
      id: req.headers['svix-id'] as string,
      timestamp: req.headers['svix-timestamp'] as string,
      signatureHeader: req.headers['svix-signature'] as string,
      rawBody,
      // Falls back to the payments secret so a single Svix endpoint covering
      // both event types works without duplicate configuration.
      secret: process.env.STITCH_CONSENT_WEBHOOK_SECRET ?? process.env.STITCH_WEBHOOK_SECRET,
    });

    if (!verdict.ok) {
      if (verdict.reason === 'missing_secret') {
        this.log.error('No DebiCheck webhook secret set — refusing unverified mandate events');
      } else {
        this.log.warn(`Rejected consent webhook: ${verdict.reason}`);
      }
      throw new UnauthorizedException('Invalid signature');
    }

    if (!isConsentWebhook(body)) {
      this.log.warn(`Consent endpoint received a non-consent payload (type=${body?.type ?? 'none'})`);
      return { received: true, applied: false };
    }

    const parsed = parseConsentWebhook(body);
    const outcome = await this.mandates.applyConsent(parsed);

    // §11.9: a mandate that stopped collecting means the tenant must be told to
    // pay manually — today, not at month-end. Surfaced here so the gap is
    // visible until the notification is wired.
    if (outcome.tenantFallbackRequired) {
      this.log.warn(
        `Mandate ${parsed.externalReference ?? parsed.providerRef} stopped collecting ` +
          `(${parsed.detail}) — tenant must be switched to proof-of-payment and notified`,
      );
    }

    return { received: true, ...outcome };
  }
}
