import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BusinessResponseDto } from './dto/business-response.dto';
import { BusinessSettingsResponseDto } from './dto/business-settings-response.dto';

@ApiTags('business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @ApiOperation({
    summary: 'Get business profile',
    description: 'Returns the business profile for the authenticated admin.',
  })
  @ApiOkResponse({ type: BusinessResponseDto })
  @Get()
  get(@BusinessId() businessId: string) {
    return this.businessService.findById(businessId);
  }

  @ApiOperation({
    summary: 'Update business profile',
    description: 'Admin-only. Partially updates the business profile.',
  })
  @ApiOkResponse({ type: BusinessResponseDto })
  @Patch()
  update(@BusinessId() businessId: string, @Body() dto: UpdateBusinessDto) {
    return this.businessService.update(businessId, dto);
  }

  @ApiOperation({
    summary: 'Get business settings',
    description: 'Returns receipt template and notification quiet-hours settings for the business.',
  })
  @ApiOkResponse({ type: BusinessSettingsResponseDto })
  @Get('settings')
  getSettings(@BusinessId() businessId: string) {
    return this.businessService.getSettings(businessId);
  }

  @ApiOperation({
    summary: 'Update business settings',
    description: 'Admin-only. Partially updates receipt and notification settings.',
  })
  @ApiOkResponse({ type: BusinessSettingsResponseDto })
  @Patch('settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateBusinessSettingsDto,
  ) {
    return this.businessService.updateSettings(businessId, dto);
  }
}
