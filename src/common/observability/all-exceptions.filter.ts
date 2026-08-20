import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorReporter } from './error-reporter';

/** Consistent error envelope + server-side logging with the request id. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly reporter?: ErrorReporter) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id || randomUUID();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? (payload as any).message
      : (exception instanceof Error ? exception.message : 'Internal server error');

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} ${status} [${requestId}] ${exception instanceof Error ? exception.stack : exception}`);

      // 5xx only. A 401 from a bad OTP or a 404 from a stale link is normal
      // operation — reporting those buries the failures that matter under noise.
      // The payload is scrubbed inside the reporter, not here.
      const principal = (req as any).user ?? {};
      this.reporter?.capture(exception, {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: status,
        vendorId: principal.vendorId ?? null,
        userId: principal.sub ?? null,
        headers: req.headers as Record<string, unknown>,
        body: (req as any).body,
      });
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      requestId,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
