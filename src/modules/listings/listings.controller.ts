import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ListingsService, CreateListingInput } from './listings.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { ListingStatus } from './listing.entity';
import { ApplicationsService, ApplyInput } from './applications.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly applications: ApplicationsService,
  ) {}

  // ---- Manager-facing listing management ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get()
  listAll() {
    return this.listings.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post()
  create(@Body() body: CreateListingInput) {
    return this.listings.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.listings.setStatus(id, 'published');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: ListingStatus }) {
    return this.listings.changeStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addPhoto(@Param('id') id: string, @UploadedFile() file: UploadedFileLike) {
    return this.listings.addPhoto(id, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Delete(':id/media')
  removePhoto(@Param('id') id: string, @Body() body: { url: string }) {
    return this.listings.removePhoto(id, body.url);
  }

  // ---- Public browse (no auth; used by the rentals.<domain> site) ----
  @Get('public')
  publicBrowse(@Query('vendor') vendor: string) {
    return this.listings.publicList(vendor);
  }

  @Get('public/:id')
  publicOne(@Param('id') id: string) {
    return this.listings.publicOne(id);
  }

  @Get('published')
  browse() {
    return this.listings.listPublished();
  }

  // ---- Applicant funnel ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('applications')
  listApplications() {
    return this.applications.list();
  }

  @Post('applications')
  apply(@Body() body: ApplyInput) {
    return this.applications.apply(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('applications/:id/screen')
  screen(@Param('id') id: string, @Body() body: { monthlyIncome?: number; creditScore?: number }) {
    return this.applications.screenApplication(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('applications/:id/approve')
  approve(@Param('id') id: string, @Body() body: { startDate: string }) {
    return this.applications.approve(id, body.startDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('applications/:id/reject')
  reject(@Param('id') id: string) {
    return this.applications.reject(id);
  }
}
