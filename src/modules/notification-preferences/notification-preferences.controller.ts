import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminId } from '../../common/decorators/admin-id.decorator';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get('preferences')
  get(@AdminId() adminId: string) {
    return this.service.get(adminId);
  }

  @Patch('preferences')
  update(
    @AdminId() adminId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.service.update(adminId, dto);
  }
}
