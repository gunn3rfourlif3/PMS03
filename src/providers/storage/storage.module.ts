import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { LocalStorageProvider } from './local.provider';
import { S3StorageProvider } from './s3.provider';

/** Binds STORAGE_PROVIDER from STORAGE_DRIVER env (default: local for dev). */
@Global()
@Module({
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [LocalStorageProvider, S3StorageProvider],
      useFactory: (local: LocalStorageProvider, s3: S3StorageProvider) =>
        (process.env.STORAGE_DRIVER ?? 'local') === 's3' ? s3 : local,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
