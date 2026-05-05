import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminId } from '../../common/decorators/admin-id.decorator';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferenceResponseDto } from './dto/notification-preference-response.dto';

@ApiTags('notification-preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Returns the authenticated admin\'s notification channel and event preferences.',
  })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  @Get('preferences')
  get(@AdminId() adminId: string) {
    return this.service.get(adminId);
  }

  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Admin-only. Partially updates notification channel and/or event toggles.',
  })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  @Patch('preferences')
  update(
    @AdminId() adminId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.service.update(adminId, dto);
  }
}
