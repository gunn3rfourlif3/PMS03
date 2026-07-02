import { Global, Module } from '@nestjs/common';
import { CHANNEL_PROVIDERS } from './notification-provider.interface';
import { PushProvider, SmsProvider, EmailProvider } from './console.providers';

/**
 * Binds a Channel -> ChannelProvider registry (a Map) so the notifications
 * processor can look up the right gateway for each channel at delivery time.
 */
@Global()
@Module({
  providers: [
    PushProvider,
    SmsProvider,
    EmailProvider,
    {
      provide: CHANNEL_PROVIDERS,
      inject: [PushProvider, SmsProvider, EmailProvider],
      useFactory: (push: PushProvider, sms: SmsProvider, email: EmailProvider) =>
        new Map([
          [push.channel, push],
          [sms.channel, sms],
          [email.channel, email],
        ]),
    },
  ],
  exports: [CHANNEL_PROVIDERS],
})
export class NotificationProvidersModule {}
