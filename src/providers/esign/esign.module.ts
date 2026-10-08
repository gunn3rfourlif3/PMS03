import { Global, Module } from '@nestjs/common';
import { ESIGN_PROVIDER } from './esign-provider.interface';
import { NativeEsignProvider } from './native.provider';
import { HttpEsignProvider } from './http.provider';
import { PrintSignEsignProvider } from './print-sign.provider';
import { deploymentCapabilities } from '@common/config/deployment-profile';

/**
 * Binds ESIGN_PROVIDER.
 *
 * The deployment mode wins over everything else: an installation that does not
 * serve e-signature gets print-and-sign even if ESIGN_API_URL is set, because a
 * sealed box with a stale provider URL in its env must not try to reach the
 * internet to sign a lease. Otherwise: HTTP provider when ESIGN_API_URL is set,
 * else the native stub.
 */
@Global()
@Module({
  providers: [
    NativeEsignProvider,
    HttpEsignProvider,
    PrintSignEsignProvider,
    {
      provide: ESIGN_PROVIDER,
      inject: [NativeEsignProvider, HttpEsignProvider, PrintSignEsignProvider],
      useFactory: (
        native: NativeEsignProvider,
        http: HttpEsignProvider,
        print: PrintSignEsignProvider,
      ) => {
        if (!deploymentCapabilities().eSignature) return print;
        return process.env.ESIGN_API_URL ? http : native;
      },
    },
  ],
  exports: [ESIGN_PROVIDER],
})
export class EsignModule {}
