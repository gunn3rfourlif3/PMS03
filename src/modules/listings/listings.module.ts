import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ApplicationsService } from './applications.service';
import { Listing } from './listing.entity';
import { Application } from './application.entity';
import { LeasingModule } from '@modules/leasing/leasing.module';
import { PropertiesModule } from '@modules/properties/properties.module';
import { IdentityModule } from '@modules/identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Application]),
    LeasingModule,
    PropertiesModule,
    IdentityModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ApplicationsService],
  exports: [ListingsService, ApplicationsService],
})
export class ListingsModule {}
