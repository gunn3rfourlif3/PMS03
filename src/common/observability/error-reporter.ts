import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { scrub, scrubHeaders, scrubUrl } from './scrub';

export interface ErrorContext {
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  /** Vendor and user ids are opaque uuids — safe to send, and the whole point. */
  vendorId?: string | null;
  userId?: string | null;
  headers?: Record<string, unknown>;
  body?: unknown;
}

/**
 * Error reporting, behind an interface like every other outbound integration
 * here (payment, notification, kyc, esign, storage).
 *
 * Sentry is loaded dynamically. If `@sentry/node` is not installed or
 * `SENTRY_DSN` is unset, this degrades to logging and the app is unaffected —
 * error tracking must never be the reason a request fails.
 *
 * ⚠ Everything is scrubbed on the way out (`scrub.ts`), in our code rather than
 * in the provider's dashboard. POPIA applies to an error payload exactly as it
 * applies to a database row, and a crash report from the payments module can
 * otherwise carry an ID number or a live OTP to a processor in another country.
 *
 * Hosted, not self-hosted, deliberately: a monitor running on the box it is
 * monitoring tells you nothing on the day that box dies.
 */
@Injectable()
export class ErrorReporter implements OnModuleInit {
  private readonly log = new Logger('ErrorReporter');
  private sentry: any;
  private enabled = false;

  async onModuleInit(): Promise<void> {
    const dsn = process.env.SENTRY_DSN?.trim();
    if (!dsn) {
      this.log.log('SENTRY_DSN not set — error reporting disabled, errors log locally only');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.sentry = require('@sentry/node');
      this.sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? 'development',
        release: process.env.APP_RELEASE,
        tracesSampleRate: 0,
        // Belt and braces. We scrub before sending; these stop the SDK adding
        // anything back in behind us.
        sendDefaultPii: false,
        maxBreadcrumbs: 20,
        beforeSend: (event: any) => {
          if (event.request) {
            delete event.request.cookies;
            delete event.request.data;
            if (event.request.headers) event.request.headers = scrubHeaders(event.request.headers);
            if (event.request.url) event.request.url = scrubUrl(String(event.request.url));
          }
          if (event.user) event.user = { id: event.user.id };
          return event;
        },
      });
      this.enabled = true;
      this.log.log(`Error reporting active (${process.env.NODE_ENV ?? 'development'})`);
    } catch (e: any) {
      this.log.warn(`SENTRY_DSN is set but @sentry/node is unavailable (${e.message}) — reporting disabled`);
    }
  }

  /** Never throws: a failure to report an error must not become a second error. */
  capture(error: unknown, context: ErrorContext = {}): void {
    if (!this.enabled) return;
    try {
      this.sentry.withScope((scope: any) => {
        scope.setTag('requestId', context.requestId ?? 'none');
        scope.setTag('route', `${context.method ?? ''} ${scrubUrl(context.url ?? '')}`.trim());
        if (context.statusCode) scope.setTag('statusCode', String(context.statusCode));
        if (context.vendorId) scope.setTag('vendorId', context.vendorId);
        if (context.userId) scope.setUser({ id: context.userId });

        scope.setContext('request', {
          method: context.method,
          url: scrubUrl(context.url ?? ''),
          headers: scrubHeaders(context.headers ?? {}),
          body: scrub(context.body),
        });

        this.sentry.captureException(error instanceof Error ? error : new Error(String(error)));
      });
    } catch (e: any) {
      this.log.warn(`Failed to report error: ${e.message}`);
    }
  }
}
