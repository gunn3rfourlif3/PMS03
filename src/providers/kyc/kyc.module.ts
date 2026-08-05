import { Global, Module, Logger } from '@nestjs/common';
import { KYC_PROVIDER } from './kyc-provider.interface';
import { ManualKycProvider } from './manual.provider';

/**
 * Binds the active KycProvider. Manual review is the only implementation today;
 * an automated provider would be selected here by env (e.g. KYC_PROVIDER=smileid)
 * without touching the application module.
 */
@Global()
@Module({
  providers: [
    ManualKycProvider,
    {
      provide: KYC_PROVIDER,
      inject: [ManualKycProvider],
      useFactory: (manual: ManualKycProvider) => {
        new Logger('KYC').log(`provider: ${manual.name}`);
        return manual;
      },
    },
  ],
  exports: [KYC_PROVIDER],
})
export class KycModule {}
