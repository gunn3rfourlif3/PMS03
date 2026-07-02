import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

/**
 * Standalone DataSource for the TypeORM CLI (migrations).
 * The runtime app builds its own connection via DatabaseModule using the same
 * options below. NEVER use synchronize:true — schema changes go through
 * migrations, which also carry the RLS policy statements.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://pms:pms@localhost:5432/pms',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ENTITIES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
