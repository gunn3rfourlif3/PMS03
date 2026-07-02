import {
  CanActivate, ExecutionContext, Injectable, Logger, Type,
  UnauthorizedException, mixin,
} from '@nestjs/common';
import { verifySignature } from './signature';

/**
 * Guard factory verifying an HMAC-SHA256 signature over the RAW request body
 * against a per-provider secret (env var). Requires the app to be created with
 * { rawBody: true } so req.rawBody is the exact bytes the provider signed.
 *
 * If the secret env var is unset, the check is SKIPPED with a warning so local
 * dev keeps working — set the secret in any real environment.
 */
export function WebhookSignatureGuard(
  secretEnvVar: string,
  header = 'x-webhook-signature',
): Type<CanActivate> {
  @Injectable()
  class Guard implements CanActivate {
    private readonly logger = new Logger('WebhookSignature');
    canActivate(ctx: ExecutionContext): boolean {
      const req = ctx.switchToHttp().getRequest();
      const secret = process.env[secretEnvVar] ?? '';
      if (!secret) {
        this.logger.warn(
          `${secretEnvVar} unset — skipping webhook signature verification (DEV ONLY)`,
        );
        return true;
      }
      const provided = req.headers[header] as string | undefined;
      const raw: Buffer | string = req.rawBody ?? JSON.stringify(req.body ?? {});
      if (!verifySignature(raw, provided, secret)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
      return true;
    }
  }
  return mixin(Guard);
}
