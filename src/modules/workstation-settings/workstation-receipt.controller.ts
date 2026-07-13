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

/**
 * Staff-accessible per-function role restrictions (configured on the merchant
 * dashboard's Workstation Settings). The workstation app reads this to decide
 * which pages the signed-in staff role may open.
 */
@ApiTags('workstation-settings')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('workstation/function-access')
export class WorkstationFunctionAccessController {
  constructor(private readonly service: WorkstationSettingsService) {}

  @ApiOperation({ summary: 'Per-function role access map for the workstation' })
  @Get()
  get(@Req() req: AuthedRequest) {
    return this.service.getFunctionAccess(req.user!.businessId);
  }
}
