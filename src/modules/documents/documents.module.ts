import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EsignService } from './esign.service';
import { Document } from './document.entity';
import { SignatureRequest } from './signature-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, SignatureRequest])],
  controllers: [DocumentsController],
  providers: [DocumentsService, EsignService],
  exports: [DocumentsService, EsignService],
})
export class DocumentsModule {}
