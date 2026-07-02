import { Injectable, Logger } from '@nestjs/common';
import { ChannelProvider, Channel, DeliveryRequest, DeliveryResult } from './notification-provider.interface';

/**
 * Dev/stub providers: log to console and report success. Replace each with a
 * real gateway (e.g. SMS/WhatsApp via an SA provider, email via SES/Postmark,
 * push via FCM/APNs). Kept as separate classes so they can be swapped 1:1.
 */
class ConsoleProvider implements ChannelProvider {
  private readonly logger = new Logger(`Notify:${this.channel}`);
  constructor(readonly channel: Channel) {}
  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    this.logger.log(`[${this.channel}] -> ${req.to}: ${req.subject}`);
    return { ok: true, providerRef: `console_${Date.now()}` };
  }
}

@Injectable() export class PushProvider extends ConsoleProvider { constructor() { super('push'); } }
@Injectable() export class SmsProvider extends ConsoleProvider { constructor() { super('sms'); } }
@Injectable() export class EmailProvider extends ConsoleProvider { constructor() { super('email'); } }
