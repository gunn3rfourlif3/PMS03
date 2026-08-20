import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/observability/logging.interceptor';
import { AllExceptionsFilter } from './common/observability/all-exceptions.filter';
import { ErrorReporter } from './common/observability/error-reporter';
import { securityHeaders } from './common/observability/security-headers.middleware';
import { validateEnv } from './common/config/validate-env';

async function bootstrap() {
  // Refuse to boot on an insecure production configuration.
  validateEnv();

  // rawBody:true exposes req.rawBody (exact bytes) for webhook HMAC verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS: explicit allowlist in production; permissive only for local dev.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : process.env.NODE_ENV === 'production' ? false : true,
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
