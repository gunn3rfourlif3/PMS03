import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/observability/logging.interceptor';
import { AllExceptionsFilter } from './common/observability/all-exceptions.filter';
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
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`PMS API listening on :${port} (health: /api/health)`);
}
bootstrap();
