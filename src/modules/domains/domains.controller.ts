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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { DomainResponseDto } from './dto/domain-response.dto';

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('domains')
export class DomainsController {
  constructor(private readonly service: DomainsService) {}

  @ApiOperation({ summary: 'List domains', description: 'Returns all custom domains registered for the business.' })
  @ApiOkResponse({ type: [DomainResponseDto] })
  @Get()
  list(@BusinessId() businessId: string) {
    return this.service.list(businessId);
  }

  @ApiOperation({
    summary: 'Register a domain',
    description:
      'Admin-only. Registers a new hostname. Returns the domain with `dnsRecords` — add these as DNS records ' +
      'at your registrar, then call `POST /domains/:id/verify` to confirm.',
  })
  @ApiCreatedResponse({ type: DomainResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateDomainDto) {
    return this.service.create(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single domain' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DomainResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @ApiOperation({
    summary: 'Verify domain ownership',
    description: 'Admin-only. Triggers a DNS TXT record check. Returns the updated domain with `sslStatus` and `verifiedAt` if successful.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DomainResponseDto })
  @Post(':id/verify')
  verify(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.verify(businessId, id);
  }

  @ApiOperation({
    summary: 'Set as primary domain',
    description: 'Admin-only. Marks this domain as the primary one. The previously primary domain is demoted.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DomainResponseDto })
  @Post(':id/set-primary')
  setPrimary(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.setPrimary(businessId, id);
  }

  @ApiOperation({ summary: 'Remove a domain', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
