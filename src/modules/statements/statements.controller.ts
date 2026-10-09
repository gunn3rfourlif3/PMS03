import {
  Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StatementsService } from './statements.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** Staff only. Reconciling a bank statement is back-office work in every mode. */
@Controller('statements')
export class StatementsController {
  constructor(private readonly service: StatementsService) {}

  /** Read and match. Writes nothing — this is the step a human looks at. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: { originalname: string; buffer: Buffer }) {
    return this.service.preview(file?.originalname ?? 'statement.csv', file?.buffer);
  }

  /** Record what the human confirmed. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('commit')
  commit(@Body() body: { allocations: { invoiceId: string; amount: number; reference?: string }[] }) {
    return this.service.commit(body?.allocations ?? []);
  }
}
