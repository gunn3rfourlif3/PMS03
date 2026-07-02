import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid JWT. Apply per-controller/route (public routes omit it). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
