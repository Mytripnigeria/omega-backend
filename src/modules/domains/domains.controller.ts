import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@UseGuards(JwtAuthGuard)
@Controller('domains')
export class DomainsController {
  constructor(private readonly service: DomainsService) {}

  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateDomainDto) {
    return this.service.create(businessId, dto);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Post(':id/verify')
  verify(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.verify(businessId, id);
  }

  @Post(':id/set-primary')
  setPrimary(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.setPrimary(businessId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
