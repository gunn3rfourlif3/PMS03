import { Logger } from '@nestjs/common';
import { ChannelProvider, Channel, DeliveryRequest, DeliveryResult } from './notification-provider.interface';

/**
 * Real HTTP-backed channel providers (dep-free, via global fetch). Each is only
 * selected by the module when its credentials are present; otherwise the console
 * stub is used. Failures are returned as { ok:false } so the delivery log records
 * the error rather than throwing the whole job.
 */
export class SendGridEmailProvider implements ChannelProvider {
  readonly channel: Channel = 'email';
  private readonly logger = new Logger('Notify:email:sendgrid');
  private readonly key = process.env.SENDGRID_API_KEY!;
  private readonly from = process.env.SENDGRID_FROM ?? 'no-reply@pms.local';

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: req.to }] }],
          from: { email: this.from },
          subject: req.subject,
          // Plain text first (fallback), then HTML when provided.
          content: req.html
            ? [{ type: 'text/plain', value: req.body }, { type: 'text/html', value: req.html }]
            : [{ type: 'text/plain', value: req.body }],
          // Don't rewrite links for click-tracking — keeps hrefs clean and lets
          // "click here" anchors stay tidy.
          tracking_settings: { click_tracking: { enable: false, enable_text: false } },
        }),
      });
      if (!res.ok) return { ok: false, error: `sendgrid ${res.status}` };
      return { ok: true, providerRef: res.headers.get('x-message-id') ?? `sg_${Date.now()}` };
    } catch (e: any) {
      this.logger.error(`send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}

export class TwilioSmsProvider implements ChannelProvider {
  readonly channel: Channel = 'sms';
  private readonly logger = new Logger('Notify:sms:twilio');
  private readonly sid = process.env.TWILIO_ACCOUNT_SID!;
  private readonly token = process.env.TWILIO_AUTH_TOKEN ?? '';
  private readonly from = process.env.TWILIO_FROM ?? '';

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64');
      const body = new URLSearchParams({ To: req.to, From: this.from, Body: `${req.subject}\n${req.body}`.trim() });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.message ?? `twilio ${res.status}` };
      return { ok: true, providerRef: json.sid };
    } catch (e: any) {
      this.logger.error(`send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}
