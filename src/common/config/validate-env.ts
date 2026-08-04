import { Logger } from '@nestjs/common';

/**
 * Fail-fast configuration guard. In production the app REFUSES TO BOOT if a
 * security-critical setting is still on its insecure development default —
 * silently shipping "change-me-in-prod" is how real breaches happen.
 * In development the same problems are logged as warnings.
 */
export function validateEnv(): void {
  const logger = new Logger('Config');
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warns: string[] = [];

  const require = (name: string, badValues: string[] = []) => {
    const v = process.env[name];
    if (!v || badValues.includes(v)) {
      (isProd ? errors : warns).push(`${name} is unset or still a development default`);
    }
  };

  require('JWT_SECRET', ['change-me-in-prod']);
  require('PII_ENCRYPTION_KEY');       // owner banking encryption key
  require('DATABASE_URL');
  require('REDIS_URL');

  // OTP codes must never be printed to logs in production, and at least one
  // channel in the delivery cascade must actually have a provider configured.
  const channels = (process.env.OTP_CHANNELS ?? process.env.OTP_CHANNEL ?? 'console')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ready: Record<string, boolean> = {
    email: !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY), // SMTP (HostAfrica) or SendGrid
    sms: !!process.env.TWILIO_ACCOUNT_SID,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    console: !isProd,
  };
  if (channels.includes('console')) {
    (isProd ? errors : warns).push('OTP delivery includes "console", which prints one-time codes to the logs — use whatsapp/email/sms with a provider configured');
  }
  if (channels.filter((c) => ready[c]).length === 0) {
    (isProd ? errors : warns).push(`OTP delivery cascade [${channels.join(',')}] has no configured provider — set SMTP_HOST or SENDGRID_API_KEY (email), WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (whatsapp), or TWILIO_ACCOUNT_SID (sms)`);
  }
  // Webhooks are unauthenticated without their signing secrets.
  for (const s of ['STITCH_WEBHOOK_SECRET']) {
    if (!process.env[s]) warns.push(`${s} unset — webhook signature verification is skipped`);
  }
  if (isProd && !process.env.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS must list the allowed browser origins in production');
  }

  warns.forEach((w) => logger.warn(w));
  if (errors.length) {
    logger.error('Refusing to start with an insecure production configuration:');
    errors.forEach((e) => logger.error(`  • ${e}`));
    throw new Error('Insecure production configuration');
  }
}
