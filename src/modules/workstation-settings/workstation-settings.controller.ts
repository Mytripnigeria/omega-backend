import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { WorkstationSettingsService } from './workstation-settings.service';
import { UpdateWorkstationSettingsDto } from './dto/update-workstation-settings.dto';
import { WorkstationSettingsResponseDto } from './dto/workstation-settings-response.dto';

@ApiTags('workstation-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workstation-settings')
export class WorkstationSettingsController {
  constructor(private readonly service: WorkstationSettingsService) {}

  @ApiOperation({
    summary: 'Get workstation settings',
    description:
      'Returns the workstation policy settings for the authenticated business. ' +
      'On first call, lazily creates a row of defaults.',
  })
  @ApiOkResponse({ type: WorkstationSettingsResponseDto })
  @Get()
  get(@BusinessId() businessId: string) {
    return this.service.get(businessId);
  }

  @ApiOperation({
    summary: 'Update workstation settings',
    description:
      'Admin-only. Partially updates the workstation policy settings (PIN, screen timeout, ' +
      'shift, notification, access-control, printing, and advanced policy fields).',
  })
  @ApiOkResponse({ type: WorkstationSettingsResponseDto })
  @Patch()
  update(
    @BusinessId() businessId: string,
    @Req() req: Request,
    @Body() dto: UpdateWorkstationSettingsDto,
  ) {
    return this.service.update(businessId, req.user as AdminJwtPayload, dto);
  }
}
