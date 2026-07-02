import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { TenantRunner } from './tenant-runner.service';
import { RlsInterceptor } from './rls.interceptor';

/**
 * Provides the tenant context everywhere and installs the RLS interceptor
 * globally so every request is tenant-scoped by default (fail-closed).
 */
@Global()
@Module({
  providers: [
    TenantContextService,
    TenantRunner,
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
  ],
  exports: [TenantContextService, TenantRunner],
})
export class TenancyModule {}
