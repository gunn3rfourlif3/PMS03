import { Global, Module } from '@nestjs/common';
import { ESIGN_PROVIDER } from './esign-provider.interface';
import { NativeEsignProvider } from './native.provider';
import { HttpEsignProvider } from './http.provider';

/** Binds ESIGN_PROVIDER: real HTTP provider when ESIGN_API_URL is set, else native stub. */
@Global()
@Module({
  providers: [
    NativeEsignProvider,
    HttpEsignProvider,
    {
      provide: ESIGN_PROVIDER,
      inject: [NativeEsignProvider, HttpEsignProvider],
      useFactory: (native: NativeEsignProvider, http: HttpEsignProvider) =>
        process.env.ESIGN_API_URL ? http : native,
    },
  ],
  exports: [ESIGN_PROVIDER],
})
export class EsignModule {}
