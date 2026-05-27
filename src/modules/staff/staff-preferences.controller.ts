import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { StaffJwtGuard } from '../../common/guards/staff-jwt.guard';
import { CurrentStaff } from '../../common/decorators/current-staff.decorator';
import type { StaffJwtPayload } from '../../common/types/jwt-payload.types';
import { StaffService } from './staff.service';
import {
  StaffPreferencesDto,
  UpdateStaffPreferencesDto,
} from './dto/preferences.dto';

/**
 * Per-staff preferences read/write — staff JWT only. Lives on /staff/me to keep
 * a clean separation from the admin-only CRUD on /staff/:id and to avoid the
 * stacking-guard problem (the StaffController is admin-gated at class level).
 */
@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('staff/me')
export class StaffPreferencesController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({
    summary: 'Get my preferences',
    description: 'Returns the calling staff member\'s client-side preferences merged with defaults.',
  })
  @ApiOkResponse({ type: StaffPreferencesDto })
  @Get('preferences')
  getPreferences(@CurrentStaff() staff: StaffJwtPayload) {
    return this.staffService.getPreferences(staff.sub);
  }

  @ApiOperation({
    summary: 'Update my preferences (partial)',
    description: 'Partial update — only the keys provided are changed. Unknown keys are silently dropped.',
  })
  @ApiOkResponse({ type: StaffPreferencesDto })
  @Patch('preferences')
  updatePreferences(
    @CurrentStaff() staff: StaffJwtPayload,
    @Body() dto: UpdateStaffPreferencesDto,
  ) {
    return this.staffService.updatePreferences(staff.sub, dto);
  }
}
