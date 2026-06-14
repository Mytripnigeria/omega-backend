import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { WorkstationSettingsService } from './workstation-settings.service';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Staff-accessible receipt details for the POS — separate from the admin-only
 * workstation-settings controller so workstation (PIN-auth) staff can read the
 * store/business receipt header, footer and address for printing.
 */
@ApiTags('workstation-settings')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('workstation/receipt-info')
export class WorkstationReceiptController {
  constructor(private readonly service: WorkstationSettingsService) {}

  @ApiOperation({ summary: 'Receipt header/footer/store details for the POS' })
  @Get()
  get(@Req() req: AuthedRequest) {
    const user = req.user!;
    const businessId = user.businessId;
    const storeId = user.sub_type === 'staff' ? user.storeId : undefined;
    return this.service.getReceiptInfo(businessId, storeId);
  }
}
