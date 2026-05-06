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
