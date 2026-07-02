/**
 * Channel-delivery abstraction. One implementation per channel; the app talks
 * to channels through this interface so SMS/WhatsApp/email/push providers can be
 * swapped per market (e.g. an SA SMS gateway) without touching domain code.
 */
export type Channel = 'push' | 'sms' | 'email' | 'whatsapp' | 'in_app';

export interface DeliveryRequest {
  to: string; // phone / email / device token, per channel
  subject: string;
  body: string;
}

export interface DeliveryResult {
  providerRef?: string;
  ok: boolean;
  error?: string;
}

export interface ChannelProvider {
  readonly channel: Channel;
  send(req: DeliveryRequest): Promise<DeliveryResult>;
}

export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
