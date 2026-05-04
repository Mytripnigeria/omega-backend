import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  get(@BusinessId() businessId: string) {
    return this.businessService.findById(businessId);
  }

  @Patch()
  update(@BusinessId() businessId: string, @Body() dto: UpdateBusinessDto) {
    return this.businessService.update(businessId, dto);
  }

  @Get('settings')
  getSettings(@BusinessId() businessId: string) {
    return this.businessService.getSettings(businessId);
  }

  @Patch('settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateBusinessSettingsDto,
  ) {
    return this.businessService.updateSettings(businessId, dto);
  }
}
