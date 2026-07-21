import { Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { PAYMENT_PROVIDER, PAYOUT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { StitchPaymentProvider } from './stitch.provider';
import { PaystackPaymentProvider } from './paystack.provider';
import { PayfastPaymentProvider } from './payfast.provider';
import { YocoPaymentProvider } from './yoco.provider';
import { PeachPaymentProvider } from './peach.provider';
import { IkhokhaPaymentProvider } from './ikhokha.provider';

/**
 * Two independently-selected rails:
 *   PAYMENT_PROVIDER — collection (money-in): stitch | paystack | payfast | yoco | peach
 *   PAYOUT_PROVIDER  — disbursement (money-out): paystack | stitch
 * A vendor can collect rent via PayFast/Yoco/Peach while owner payouts still
 * settle through a payout-capable rail. Selection is env-driven; billing and
 * accounting code never see a provider name.
 */
@Module({
  providers: [
    StitchPaymentProvider, PaystackPaymentProvider,
    PayfastPaymentProvider, YocoPaymentProvider, PeachPaymentProvider, IkhokhaPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [StitchPaymentProvider, PaystackPaymentProvider, PayfastPaymentProvider, YocoPaymentProvider, PeachPaymentProvider, IkhokhaPaymentProvider],
      useFactory: (stitch, paystack, payfast, yoco, peach, ikhokha): PaymentProvider => {
        const registry: Record<string, PaymentProvider> = {
          stitch, paystack, payfast, yoco, peach, ikhokha,
        };
        // First deploy: iKhokha is the only live collection rail.
        const chosen = registry[(process.env.PAYMENT_PROVIDER ?? 'ikhokha').toLowerCase()] ?? ikhokha;
        new Logger('Payments').log(`collection rail: ${chosen.name}`);
        return chosen;
      },
    },
    {
      provide: PAYOUT_PROVIDER,
      inject: [PaystackPaymentProvider, StitchPaymentProvider],
      useFactory: (paystack, stitch): PaymentProvider => {
        const registry: Record<string, PaymentProvider> = { paystack, stitch };
        const chosen = registry[(process.env.PAYOUT_PROVIDER ?? 'paystack').toLowerCase()] ?? paystack;
        new Logger('Payments').log(`payout rail: ${chosen.name}`);
        return chosen;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER, PAYOUT_PROVIDER],
})
export class PaymentModule {}
