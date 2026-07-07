import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Infrastructure
import { DatabaseModule } from './common/database/database.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { QueueModule } from './common/queue/queue.module';

// Auth
import { AuthModule } from './modules/auth/auth.module';

// Domain modules (modular monolith — clean boundaries, single deploy)
import { IdentityModule } from './modules/identity/identity.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { OwnersModule } from './modules/owners/owners.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { LeasingModule } from './modules/leasing/leasing.module';
import { ListingsModule } from './modules/listings/listings.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { BillingModule } from './modules/billing/billing.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CommsModule } from './modules/comms/comms.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { MeModule } from './modules/me/me.module';
import { BrandingModule } from './modules/branding/branding.module';
import { ServiceProvidersModule } from './modules/service-providers/service-providers.module';

// Cross-cutting provider layers
import { PaymentModule } from './providers/payment/payment.module';
import { PolicyModule } from './providers/policy/policy.module';
import { NotificationProvidersModule } from './providers/notification/notification-providers.module';
import { StorageModule } from './providers/storage/storage.module';
import { EsignModule } from './providers/esign/esign.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit: 120 requests / minute / IP. (Use a Redis storage in
    // multi-instance production so the limit is shared across instances.)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    DatabaseModule,
    QueueModule,
    TenancyModule,
    AuthModule,
    PaymentModule,
    PolicyModule,
    NotificationProvidersModule,
    StorageModule,
    EsignModule,
    IdentityModule,
    ExpensesModule,
    OwnersModule,
    PropertiesModule,
    LeasingModule,
    ListingsModule,
    InspectionsModule,
    BillingModule,
    AccountingModule,
    MaintenanceModule,
    DocumentsModule,
    CommsModule,
    NotificationsModule,
    ReportingModule,
    ApiKeysModule,
    MeModule,
    BrandingModule,
    ServiceProvidersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
