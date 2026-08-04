import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ChannelProvider, Channel, DeliveryRequest, DeliveryResult } from './notification-provider.interface';

/**
 * SMTP email via nodemailer — used when SMTP_HOST is set. Ideal when the
 * destination mailbox lives on the same provider (e.g. HostAfrica): the sending
 * domain's own SPF/DKIM authorise the mail server, so delivery to your own inbox
 * doesn't depend on third-party domain authentication.
 */
export class SmtpEmailProvider implements ChannelProvider {
  readonly channel: Channel = 'email';
  private readonly logger = new Logger('Notify:email:smtp');
  private readonly from = process.env.SMTP_FROM ?? process.env.SENDGRID_FROM ?? 'no-reply@locare.co.za';
  private readonly port = Number(process.env.SMTP_PORT ?? 587);
  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: this.port,
    // 465 is implicit TLS; 587/25 start plaintext then STARTTLS. Honour an
    // explicit SMTP_SECURE override for edge cases.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : this.port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });

  async send(req: DeliveryRequest): Promise<DeliveryResult> {
    try {
      const info = await this.transport.sendMail({
        from: this.from,
        to: req.to,
        subject: req.subject,
        text: req.body,
        ...(req.html ? { html: req.html } : {}),
        ...(req.replyTo
          ? { replyTo: req.replyTo.name ? `${req.replyTo.name} <${req.replyTo.email}>` : req.replyTo.email }
          : {}),
      });
      return { ok: true, providerRef: info.messageId };
    } catch (e: any) {
      this.logger.error(`send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}

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
          ...(req.replyTo ? { reply_to: { email: req.replyTo.email, ...(req.replyTo.name ? { name: req.replyTo.name } : {}) } } : {}),
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
