import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { StoreLinksService } from './store-links.service';
import {
  RequestStoreLinkDto,
  RespondStoreLinkDto,
} from './dto/store-link.dto';

type AuthedRequest = Request & { user?: JwtPayload };

/**
 * Cross-store order help.
 *
 * A workstation asks to help run another store's orders; that store's owner
 * approves from their own dashboard. Requests are made with a staff token (the
 * workstation), responses with an admin token (the dashboard) — which is why
 * the class guard is the permissive one and the admin-only routes tighten it
 * per method. A class-level admin guard would 401 the workstation outright.
 */
@ApiTags('store-links')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('store-links')
export class StoreLinksController {
  constructor(private readonly service: StoreLinksService) {}

  @ApiOperation({
    summary: "Links this workstation's store has requested",
  })
  @Get('outgoing')
  outgoing(@Req() req: AuthedRequest) {
    const user = req.user!;
    const storeId =
      user.sub_type === 'staff' ? user.storeId : (req.query.storeId as string);
    return this.service.listOutgoing(storeId!);
  }

  @ApiOperation({
    summary: 'Requests other stores have made to work your orders',
    description: 'Merchant dashboard view — these are yours to approve or decline.',
  })
  @UseGuards(JwtAuthGuard)
  @Get('incoming')
  incoming(@Req() req: AuthedRequest) {
    return this.service.listIncoming(req.user!.businessId);
  }

  @ApiOperation({
    summary: 'Ask to help run another store’s orders',
    description:
      'Sent from the workstation with the target store id. It stays pending ' +
      "until that store's business approves it.",
  })
  @Post()
  request(@Req() req: AuthedRequest, @Body() dto: RequestStoreLinkDto) {
    const user = req.user!;
    if (user.sub_type !== 'staff' || !user.storeId) {
      throw new Error('Store link requests come from a workstation session');
    }
    return this.service.request(user.businessId, user.storeId, dto, user.sub);
  }

  @ApiOperation({ summary: 'Approve or decline a request to your store' })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  respond(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RespondStoreLinkDto,
  ) {
    const user = req.user!;
    const actorName =
      user.sub_type === 'admin' ? user.email : 'Owner';
    return this.service.respond(user.businessId, id, dto, user.sub, actorName);
  }

  @ApiOperation({
    summary: 'End a link',
    description:
      'Either side may end it — the workstation giving up access, or the ' +
      'store withdrawing it.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() req: AuthedRequest, @Param('id') id: string) {
    const user = req.user!;
    return this.service.revoke({
      id,
      businessId: user.businessId,
      storeId: user.sub_type === 'staff' ? user.storeId : undefined,
    });
  }
}
