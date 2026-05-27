import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { PushService } from './push.service';
import {
  CreatePushSubscriptionDto,
  PushSubscriptionResponseDto,
} from './dto/push-subscription.dto';

interface AuthedUserRequest extends Request {
  user?: UserJwtPayload;
}

/**
 * Public VAPID-key endpoint + storefront-customer subscription endpoints.
 * The storefront app fetches the public key once, asks the SW to subscribe,
 * and POSTs the resulting PushSubscription to /push-subscriptions.
 */
@ApiTags('notifications')
@Controller()
export class PushNotificationsController {
  constructor(private readonly pushService: PushService) {}

  @ApiOperation({
    summary: 'Public VAPID key',
    description: 'Used by the storefront PWA to subscribe browsers to push.',
  })
  @ApiOkResponse({ schema: { example: { publicKey: 'B...' } } })
  @Get('notifications/web-push/public-key')
  publicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @ApiOperation({ summary: 'Register a web-push subscription for the current customer.' })
  @ApiBearerAuth()
  @UseGuards(UserJwtGuard)
  @ApiCreatedResponse({ type: PushSubscriptionResponseDto })
  @Post('storefront/me/push-subscriptions')
  subscribe(
    @Req() req: AuthedUserRequest,
    @Body() dto: CreatePushSubscriptionDto,
  ) {
    const user = req.user!;
    return this.pushService
      .subscribe('customer', user.customerId, user.businessId, dto)
      .then((row) => PushSubscriptionResponseDto.from(row));
  }

  @ApiOperation({ summary: 'List push subscriptions for the current customer.' })
  @ApiBearerAuth()
  @UseGuards(UserJwtGuard)
  @ApiOkResponse({ type: [PushSubscriptionResponseDto] })
  @Get('storefront/me/push-subscriptions')
  async list(@Req() req: AuthedUserRequest) {
    const user = req.user!;
    const rows = await this.pushService.listForSubject('customer', user.customerId);
    return rows.map(PushSubscriptionResponseDto.from);
  }

  @ApiOperation({ summary: 'Unsubscribe a push subscription.' })
  @ApiBearerAuth()
  @UseGuards(UserJwtGuard)
  @ApiNoContentResponse()
  @Delete('storefront/me/push-subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@Req() req: AuthedUserRequest, @Param('id') id: string) {
    const user = req.user!;
    return this.pushService.unsubscribe('customer', user.customerId, id);
  }
}
