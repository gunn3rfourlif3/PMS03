/**
 * Channel-delivery abstraction. One implementation per channel; the app talks
 * to channels through this interface so SMS/WhatsApp/email/push providers can be
 * swapped per market (e.g. an SA SMS gateway) without touching domain code.
 */
export type Channel = 'push' | 'sms' | 'email' | 'whatsapp' | 'in_app';

export interface DeliveryRequest {
  to: string; // phone / email / device token, per channel
  subject: string;
  body: string;        // plain-text (always sent; SMS uses this)
  html?: string;       // optional rich HTML for email — friendly "click here" links
  replyTo?: { email: string; name?: string }; // email only — lets the team reply straight to the sender
  /**
   * Email only — override the configured sender for this one message, e.g. an
   * acknowledgement that should come from a person rather than the system
   * mailbox. Must be an address the SMTP account is allowed to send as (same
   * domain, real mailbox or alias) or the relay will refuse it.
   */
  from?: { email: string; name?: string };
  /**
   * WhatsApp only. Business-initiated WhatsApp messages must use a pre-approved
   * template; `vars` fill the body's {{1}},{{2}}… in order. `kind: 'auth'` adds
   * the one-time-code copy button (the first var is treated as the code). Other
   * channels ignore this and use `body`.
   */
  template?: { name: string; lang?: string; vars: string[]; kind?: 'auth' | 'utility' };
}

export interface DeliveryResult {
  providerRef?: string;
  ok: boolean;
  error?: string;
  /**
   * Email only — what the relay said about each recipient at RCPT TO.
   *
   * `ok` means the relay TOOK the message, which is not the same as a mailbox
   * receiving it: a bad address, a full box or a domain with no MX all fail
   * later and out of band, as a bounce to the sender. Callers that care about
   * the difference should say "accepted", not "sent".
   */
  accepted?: string[];
  rejected?: string[];
}

export interface ChannelProvider {
  readonly channel: Channel;
  send(req: DeliveryRequest): Promise<DeliveryResult>;
}

export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
