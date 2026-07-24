import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './leads.dto';

/** Public lead capture for the marketing site (agent signup / demo / contact). */
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }
}
