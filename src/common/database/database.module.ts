import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Global DB module. Uses the same options as the migration DataSource so the
 * running app and the CLI never diverge. Marked @Global so repositories can be
 * injected anywhere via TypeOrmModule.forFeature in each domain module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
})
export class DatabaseModule {}
