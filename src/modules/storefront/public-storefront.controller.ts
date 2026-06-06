import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { StorefrontService } from './storefront.service';

@ApiTags('public-storefront')
@Controller('public/storefront')
export class PublicStorefrontController {
  constructor(private readonly service: StorefrontService) {}

  @ApiOperation({
    summary: 'Public storefront config',
    description: 'Returns the merchant-configured storefront config (theme, status, toggles, social, SEO).',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('config')
  getConfig(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.publicConfig(businessId);
  }

  @ApiOperation({
    summary: 'Resolve a business by custom domain',
    description:
      'Maps a hostname (e.g. scoops.ng) to the owning businessId so one storefront ' +
      'deployment can serve many merchants by domain.',
  })
  @ApiQuery({ name: 'host', example: 'scoops.ng' })
  @Get('resolve')
  resolve(@Query('host') host: string) {
    if (!host) throw new BadRequestException('host is required');
    return this.service.resolveByDomain(host);
  }

  @ApiOperation({
    summary: 'Enabled payment methods',
    description:
      'Public list of payment methods the merchant has enabled (paystack/card, cash, ' +
      'transfer, wallet). Transfer methods include sanitised bank details.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('payment-methods')
  getPaymentMethods(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.publicPaymentMethods(businessId);
  }

  @ApiOperation({
    summary: 'Active storefront banners',
    description: 'Returns currently-active banners ordered by position. Filters out scheduled banners outside their window.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('banners')
  getBanners(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.publicBanners(businessId);
  }

  @ApiOperation({
    summary: 'Published storefront pages',
    description: 'Returns the navigation list of published storefront pages.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('pages')
  getPages(@Query('businessId') businessId: string) {
    if (!businessId) throw new BadRequestException('businessId is required');
    return this.service.publicPages(businessId);
  }

  @ApiOperation({
    summary: 'Get a published page by slug',
    description: 'Increments view count. Returns 404 for unpublished pages.',
  })
  @ApiQuery({ name: 'businessId', format: 'uuid' })
  @Get('pages/:slug')
  getPageBySlug(
    @Param('slug') slug: string,
    @Query('businessId') businessId: string,
    @Req() req: Request,
  ) {
    if (!businessId) throw new BadRequestException('businessId is required');
    const ip = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    return this.service.publicPageBySlug(businessId, slug, {
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    });
  }
}
