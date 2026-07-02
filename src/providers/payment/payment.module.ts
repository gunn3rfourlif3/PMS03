import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StitchPaymentProvider } from './stitch.provider';
import { PaystackPaymentProvider } from './paystack.provider';

/**
 * Binds the active PaymentProvider from PAYMENT_PROVIDER env (default: stitch).
 * Swap providers per market without touching billing/accounting code.
 */
@Module({
  providers: [
    StitchPaymentProvider,
    PaystackPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [StitchPaymentProvider, PaystackPaymentProvider],
      useFactory: (stitch: StitchPaymentProvider, paystack: PaystackPaymentProvider) =>
        (process.env.PAYMENT_PROVIDER ?? 'stitch') === 'paystack' ? paystack : stitch,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
