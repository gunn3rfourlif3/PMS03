import { Global, Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CHANNEL_PROVIDERS, ChannelProvider } from './notification-provider.interface';
import { PushProvider, SmsProvider, EmailProvider } from './console.providers';
import { SendGridEmailProvider, SmtpEmailProvider, TwilioSmsProvider, WhatsAppCloudProvider } from './http.providers';

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
        // Email preference: SMTP (e.g. HostAfrica) → SendGrid → console stub.
        const email: ChannelProvider = process.env.SMTP_HOST
          ? new SmtpEmailProvider()
          : process.env.SENDGRID_API_KEY
            ? new SendGridEmailProvider()
            : new EmailProvider();
        const sms: ChannelProvider = process.env.TWILIO_ACCOUNT_SID ? new TwilioSmsProvider() : new SmsProvider();
        const push: ChannelProvider = new PushProvider();
        // WhatsApp is only present when the Cloud API is configured; otherwise the
        // cascade simply skips it and uses email.
        const whatsapp = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID
          ? new WhatsAppCloudProvider()
          : undefined;
        log.log(`channels — email:${email.constructor.name} sms:${sms.constructor.name} push:${push.constructor.name} whatsapp:${whatsapp ? 'WhatsAppCloudProvider' : 'off'}`);
        const entries: Array<[Channel_, ChannelProvider]> = [
          [push.channel, push],
          [sms.channel, sms],
          [email.channel, email],
        ];
        if (whatsapp) entries.push([whatsapp.channel, whatsapp]);
        return new Map<Channel_, ChannelProvider>(entries);
      },
    },
  ],
  exports: [CHANNEL_PROVIDERS],
})
export class NotificationProvidersModule {}

// local alias to satisfy the Map key type without importing the union name twice
type Channel_ = ChannelProvider['channel'];
