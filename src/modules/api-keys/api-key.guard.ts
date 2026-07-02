import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parsePrefix, verifyKey } from './api-key.util';

/**
 * Authenticates external requests by `x-api-key`. Resolves the key's vendor via
 * the api_key_lookup SECURITY DEFINER function (the incoming request has no
 * vendor context yet), verifies the hash, checks revoked/expired, then sets
 * req.user so the global RLS interceptor scopes everything to that vendor.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const provided = req.headers['x-api-key'] as string | undefined;
    const prefix = parsePrefix(provided);
    if (!prefix) throw new UnauthorizedException('Missing or malformed API key');

    const rows = await this.dataSource.query('SELECT * FROM api_key_lookup($1)', [prefix]);
    const rec = rows[0];
    if (!rec) throw new UnauthorizedException('Invalid API key');
    if (rec.revoked_at) throw new UnauthorizedException('API key revoked');
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }
    if (!verifyKey(provided as string, rec.key_hash)) {
      throw new UnauthorizedException('Invalid API key');
    }

    req.user = { vendorId: rec.vendor_id, userId: null, roles: rec.scopes ?? [] };
    return true;
  }
}
