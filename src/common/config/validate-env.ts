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

  // OTP codes must never be printed to logs in production, and the chosen
  // channel must actually have a provider configured to deliver them.
  const otpChannel = process.env.OTP_CHANNEL ?? 'console';
  if (otpChannel === 'console') {
    (isProd ? errors : warns).push('OTP_CHANNEL=console prints one-time codes to the logs — set it to email or sms with a provider configured');
  } else if (otpChannel === 'email' && !process.env.SENDGRID_API_KEY) {
    (isProd ? errors : warns).push('OTP_CHANNEL=email but SENDGRID_API_KEY is unset — codes cannot be delivered');
  } else if (otpChannel === 'sms' && !process.env.TWILIO_ACCOUNT_SID) {
    (isProd ? errors : warns).push('OTP_CHANNEL=sms but TWILIO_ACCOUNT_SID is unset — codes cannot be delivered');
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
