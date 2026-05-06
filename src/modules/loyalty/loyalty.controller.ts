import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { LoyaltyService } from './loyalty.service';
import {
  CreateLoyaltyTierDto,
  LoyaltySettingsResponseDto,
  LoyaltyStatsDto,
  LoyaltyTierFilterDto,
  LoyaltyTierResponseDto,
  UpdateLoyaltySettingsDto,
  UpdateLoyaltyTierDto,
} from './dto/loyalty.dto';

@ApiTags('loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  // ─── Tiers ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List loyalty tiers (admin)' })
  @Get('tiers')
  listTiers(
    @BusinessId() businessId: string,
    @Query() filter: LoyaltyTierFilterDto,
  ) {
    return this.service.listTiers(businessId, filter);
  }

  @ApiOperation({ summary: 'Get a loyalty tier (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LoyaltyTierResponseDto })
  @Get('tiers/:id')
  findTier(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findTier(businessId, id);
  }

  @ApiOperation({ summary: 'Create a loyalty tier (admin)' })
  @ApiCreatedResponse({ type: LoyaltyTierResponseDto })
  @Post('tiers')
  createTier(
    @BusinessId() businessId: string,
    @Body() dto: CreateLoyaltyTierDto,
  ) {
    return this.service.createTier(businessId, dto);
  }

  @ApiOperation({ summary: 'Update a loyalty tier (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LoyaltyTierResponseDto })
  @Patch('tiers/:id')
  updateTier(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyTierDto,
  ) {
    return this.service.updateTier(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a loyalty tier (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete('tiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTier(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.removeTier(businessId, id);
  }

  // ─── Settings ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get loyalty program settings' })
  @ApiOkResponse({ type: LoyaltySettingsResponseDto })
  @Get('settings')
  getSettings(@BusinessId() businessId: string) {
    return this.service.getSettings(businessId);
  }

  @ApiOperation({ summary: 'Update loyalty program settings' })
  @ApiOkResponse({ type: LoyaltySettingsResponseDto })
  @Patch('settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateLoyaltySettingsDto,
  ) {
    return this.service.updateSettings(businessId, dto);
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Loyalty program stats' })
  @ApiOkResponse({ type: LoyaltyStatsDto })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }
}
