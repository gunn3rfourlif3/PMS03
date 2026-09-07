import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/observability/logging.interceptor';
import { AllExceptionsFilter } from './common/observability/all-exceptions.filter';
import { ErrorReporter } from './common/observability/error-reporter';
import { securityHeaders } from './common/observability/security-headers.middleware';
import { validateEnv } from './common/config/validate-env';
import { HostsService } from './modules/hosts/hosts.service';

async function bootstrap() {
  // Refuse to boot on an insecure production configuration.
  validateEnv();

  // rawBody:true exposes req.rawBody (exact bytes) for webhook HMAC verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS is resolved PER REQUEST, not fixed at boot: CORS_ORIGINS first, then
  // any host an active vendor claims. An agency's domain therefore starts
  // working the moment it is set in the back-office, with no redeploy — and it
  // can never disagree with the TLS allowlist, because it is the same lookup.
  // (docs/LOCARE_ONDEMAND_TLS_DESIGN.md §5)
  const hosts = app.get(HostsService);
  const devOpen = process.env.NODE_ENV !== 'production' && !process.env.CORS_ORIGINS;
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (devOpen) return cb(null, true);
      hosts
        .isAllowedOrigin(origin)
        // false, not an error: a rejected origin should be a clean CORS block,
        // not a 500 that looks like the API fell over.
        .then((ok) => cb(null, ok))
        .catch(() => cb(null, false));
    },
    credentials: true,
  });

  app.use(securityHeaders);
  app.getHttpAdapter().getInstance().disable?.('x-powered-by');
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  // Resolved from the container so the filter reports 5xx to Sentry when
  // configured, and logs only when it is not.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(ErrorReporter, { strict: false })));
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`PMS API listening on :${port} (health: /api/health)`);
}
bootstrap();
