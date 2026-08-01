import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface GoogleIdentity {
  email: string;
  sub: string;
  name?: string;
}

/**
 * Google OAuth 2.0 (Authorization Code). The id_token is fetched server-to-server
 * from Google's token endpoint using our client secret, so it arrives over a
 * trusted channel — we still validate iss / aud / exp / email_verified defensively.
 * One fixed redirect URI (AUTH_BASE/api/auth/google/callback) keeps custom domains
 * and wildcard subdomains out of the Google console.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly log = new Logger('GoogleOAuth');
  private readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  private readonly authBase = (process.env.AUTH_BASE ?? '').replace(/\/+$/, '');

  get enabled(): boolean {
    return process.env.GOOGLE_OAUTH_ENABLED === 'true'
      && !!this.clientId && !!this.clientSecret && !!this.authBase;
  }

  private redirectUri(): string {
    return `${this.authBase}/api/auth/google/callback`;
  }

  /** Build the Google consent URL for a signed `state`. */
  authorizeUrl(state: string): string {
    const p = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  }

  /** Exchange the auth code for the verified identity carried in the id_token. */
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) {
      this.log.error(`Google token exchange failed: ${res.status}`);
      throw new BadRequestException('Google sign-in failed. Please try again.');
    }
    const json: any = await res.json().catch(() => ({}));
    const idToken: string | undefined = json.id_token;
    if (!idToken) throw new BadRequestException('Google sign-in failed. Please try again.');

    const c = this.decode(idToken);
    if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') {
      throw new BadRequestException('Invalid Google token.');
    }
    if (c.aud !== this.clientId) throw new BadRequestException('Invalid Google token.');
    if (typeof c.exp === 'number' && c.exp * 1000 < Date.now()) {
      throw new BadRequestException('Google sign-in expired. Please try again.');
    }
    if (!c.email || c.email_verified !== true) {
      throw new BadRequestException('Your Google email is not verified.');
    }
    return { email: String(c.email).toLowerCase(), sub: String(c.sub), name: c.name ? String(c.name) : undefined };
  }

  private decode(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new BadRequestException('Invalid Google token.');
    try {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid Google token.');
    }
  }
}
