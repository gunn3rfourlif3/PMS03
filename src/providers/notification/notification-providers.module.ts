import { Global, Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CHANNEL_PROVIDERS, ChannelProvider } from './notification-provider.interface';
import { PushProvider, SmsProvider, EmailProvider } from './console.providers';
import { SendGridEmailProvider, TwilioSmsProvider } from './http.providers';

/**
 * Binds a Channel -> ChannelProvider registry (a Map). Real gateways are used
 * when their credentials are configured; otherwise each channel falls back to
 * the console stub so dev/CI need no secrets.
 */
@Global()
@Module({
  providers: [
    {
      provide: CHANNEL_PROVIDERS,
      useFactory: () => {
        const log = new Logger('Notify');
        const email: ChannelProvider = process.env.SENDGRID_API_KEY ? new SendGridEmailProvider() : new EmailProvider();
        const sms: ChannelProvider = process.env.TWILIO_ACCOUNT_SID ? new TwilioSmsProvider() : new SmsProvider();
        const push: ChannelProvider = new PushProvider();
        log.log(`channels — email:${email.constructor.name} sms:${sms.constructor.name} push:${push.constructor.name}`);
        return new Map<Channel_, ChannelProvider>([
          [push.channel, push],
          [sms.channel, sms],
          [email.channel, email],
        ]);
      },
    },
  ],
  exports: [CHANNEL_PROVIDERS],
})
export class NotificationProvidersModule {}

// local alias to satisfy the Map key type without importing the union name twice
type Channel_ = ChannelProvider['channel'];
