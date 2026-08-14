import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
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
import { ChangePinDto } from './dto/change-pin.dto';

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
    summary: 'Change my login PIN',
    description:
      'Staff-initiated. Verifies the PIN currently in use before replacing it, ' +
      'so an unattended logged-in till cannot be used to lock the owner out.',
  })
  @ApiNoContentResponse()
  @Patch('pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePin(@CurrentStaff() staff: StaffJwtPayload, @Body() dto: ChangePinDto) {
    return this.staffService.changeOwnPin(staff.sub, dto);
  }

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
