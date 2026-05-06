import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { ReferralsService } from './referrals.service';
import {
  MyReferralsSummaryDto,
  ReferralFilterDto,
  ReferralResponseDto,
  ReferralSettingsResponseDto,
  ReferralStatsDto,
  UpdateReferralSettingsDto,
} from './dto/referral.dto';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @ApiOperation({ summary: 'List referrals (admin)' })
  @Get()
  list(
    @BusinessId() businessId: string,
    @Query() filter: ReferralFilterDto,
  ) {
    return this.service.list(businessId, filter);
  }

  @ApiOperation({ summary: 'Referral stats' })
  @ApiOkResponse({ type: ReferralStatsDto })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @ApiOperation({ summary: 'Get referral program settings' })
  @ApiOkResponse({ type: ReferralSettingsResponseDto })
  @Get('settings')
  getSettings(@BusinessId() businessId: string) {
    return this.service.getSettings(businessId);
  }

  @ApiOperation({ summary: 'Update referral program settings' })
  @ApiOkResponse({ type: ReferralSettingsResponseDto })
  @Patch('settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateReferralSettingsDto,
  ) {
    return this.service.updateSettings(businessId, dto);
  }

  @ApiOperation({ summary: 'Get a single referral (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ReferralResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }
}

// ─── Storefront-facing ──────────────────────────────────────────────

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/referrals')
export class StorefrontReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @ApiOperation({ summary: 'My referral code + referral history' })
  @ApiOkResponse({ type: MyReferralsSummaryDto })
  @Get()
  mySummary(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.service.mySummary(user.businessId, user.customerId);
  }
}
