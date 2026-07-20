import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Per-request logging + a correlation id (x-request-id) for tracing. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    if (!req.id) req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', req.id);
    const started = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${originalUrl} ${res.statusCode} ${Date.now() - started}ms [${req.id}]`),
        error: (err) => this.logger.warn(`${method} ${originalUrl} ${err?.status ?? 500} ${Date.now() - started}ms [${req.id}] ${err?.message ?? ''}`),
      }),
    );
  }
}
