import { Global, Module } from '@nestjs/common';
import { ESIGN_PROVIDER } from './esign-provider.interface';
import { NativeEsignProvider } from './native.provider';

/** Binds ESIGN_PROVIDER (default: native stub; swap for DocuSign etc.). */
@Global()
@Module({
  providers: [
    NativeEsignProvider,
    { provide: ESIGN_PROVIDER, useClass: NativeEsignProvider },
  ],
  exports: [ESIGN_PROVIDER],
})
export class EsignModule {}
