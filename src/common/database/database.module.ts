import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Global DB module.
 *
 * Runtime app connects as the LEAST-PRIVILEGED role (APP_DATABASE_URL, e.g.
 * pms_app with NOBYPASSRLS) so Postgres Row-Level Security is actually enforced.
 * Migrations + seed use the owner role (DATABASE_URL) which owns objects and can
 * run DDL. installExtensions:false because the app role may not CREATE EXTENSION
 * (migrations already installed pgcrypto/uuid-ossp).
 */
const runtimeUrl =
  process.env.APP_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://pms:pms@localhost:5432/pms';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...(dataSourceOptions as any),
      url: runtimeUrl,
      installExtensions: false,
    } as any),
  ],
})
export class DatabaseModule {}
