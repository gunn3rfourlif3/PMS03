import { NestFactory } from '@nestjs/core';

import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';



async function bootstrap() {
  // rawBody:true exposes req.rawBody (exact bytes) for webhook HMAC verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`PMS API listening on :${port}`);
}
bootstrap();
