import { Controller, Get, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { Socket } from 'node:net';

/** Liveness + readiness probes for load balancers / Kubernetes / CI. Public. */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness: the process is up. No dependencies touched. */
  @Get()
  live() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  /** Readiness: dependencies (Postgres + Redis) are reachable. 503 if not. */
  @Get('ready')
  async ready(@Res() res: Response) {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const ok = db && redis;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
      timestamp: new Date().toISOString(),
    });
  }

  private async checkDb(): Promise<boolean> {
    try { await this.dataSource.query('SELECT 1'); return true; } catch { return false; }
  }

  private checkRedis(): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
      const sock = new Socket();
      const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
      sock.setTimeout(1500);
      sock.once('error', () => done(false));
      sock.once('timeout', () => done(false));
      sock.connect(Number(url.port || 6379), url.hostname, () => {
        sock.write('PING\r\n');
        sock.once('data', (d) => done(d.toString().includes('PONG') || d.toString().includes('NOAUTH')));
      });
    });
  }
}
