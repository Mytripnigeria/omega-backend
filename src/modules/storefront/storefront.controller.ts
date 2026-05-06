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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { StorefrontService } from './storefront.service';
import {
  StorefrontConfigResponseDto,
  UpdateStorefrontConfigDto,
} from './dto/config.dto';
import {
  CreateStorefrontPageDto,
  ReorderDto,
  StorefrontPageFilterDto,
  StorefrontPageResponseDto,
  UpdateStorefrontPageDto,
} from './dto/page.dto';
import {
  CreateStorefrontBannerDto,
  StorefrontBannerFilterDto,
  StorefrontBannerResponseDto,
  UpdateStorefrontBannerDto,
} from './dto/banner.dto';
import {
  CreateThemePresetDto,
  ThemePresetResponseDto,
} from './dto/theme.dto';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly service: StorefrontService) {}

  // ---------- Config ----------

  @ApiOperation({
    summary: 'Get storefront config',
    description: 'Lazily creates defaults on first read.',
  })
  @ApiOkResponse({ type: StorefrontConfigResponseDto })
  @Get('config')
  getConfig(@BusinessId() businessId: string) {
    return this.service.getConfig(businessId);
  }

  @ApiOperation({ summary: 'Update storefront config' })
  @ApiOkResponse({ type: StorefrontConfigResponseDto })
  @Patch('config')
  updateConfig(@Req() req: Request, @Body() dto: UpdateStorefrontConfigDto) {
    return this.service.updateConfig(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Storefront stats' })
  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  // ---------- Themes ----------

  @ApiOperation({ summary: 'List theme presets' })
  @ApiOkResponse({ type: [ThemePresetResponseDto] })
  @Get('themes')
  listThemes(@BusinessId() businessId: string) {
    return this.service.listThemes(businessId);
  }

  @ApiOperation({ summary: 'Create a custom theme preset' })
  @ApiCreatedResponse({ type: ThemePresetResponseDto })
  @Post('themes')
  createTheme(@Req() req: Request, @Body() dto: CreateThemePresetDto) {
    return this.service.createTheme(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Delete a custom theme preset' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete('themes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTheme(@Req() req: Request, @Param('id') id: string) {
    return this.service.deleteTheme(req.user as AdminJwtPayload, id);
  }

  // ---------- Pages ----------

  @ApiOperation({ summary: 'List storefront pages' })
  @Get('pages')
  listPages(
    @BusinessId() businessId: string,
    @Query() filter: StorefrontPageFilterDto,
  ) {
    return this.service.listPages(businessId, filter);
  }

  @ApiOperation({ summary: 'Reorder storefront pages' })
  @ApiNoContentResponse()
  @Patch('pages/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderPages(@Req() req: Request, @Body() dto: ReorderDto) {
    return this.service.reorderPages(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Get a single storefront page' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StorefrontPageResponseDto })
  @Get('pages/:id')
  getPage(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.getPage(businessId, id);
  }

  @ApiOperation({ summary: 'Create a storefront page' })
  @ApiCreatedResponse({ type: StorefrontPageResponseDto })
  @Post('pages')
  createPage(@Req() req: Request, @Body() dto: CreateStorefrontPageDto) {
    return this.service.createPage(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Update a storefront page' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StorefrontPageResponseDto })
  @Patch('pages/:id')
  updatePage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateStorefrontPageDto,
  ) {
    return this.service.updatePage(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Delete a storefront page' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete('pages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePage(@Req() req: Request, @Param('id') id: string) {
    return this.service.deletePage(req.user as AdminJwtPayload, id);
  }

  // ---------- Banners ----------

  @ApiOperation({ summary: 'List banners' })
  @Get('banners')
  listBanners(
    @BusinessId() businessId: string,
    @Query() filter: StorefrontBannerFilterDto,
  ) {
    return this.service.listBanners(businessId, filter);
  }

  @ApiOperation({ summary: 'Reorder banners' })
  @ApiNoContentResponse()
  @Patch('banners/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderBanners(@Req() req: Request, @Body() dto: ReorderDto) {
    return this.service.reorderBanners(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Get a single banner' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StorefrontBannerResponseDto })
  @Get('banners/:id')
  getBanner(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.getBanner(businessId, id);
  }

  @ApiOperation({ summary: 'Create a banner' })
  @ApiCreatedResponse({ type: StorefrontBannerResponseDto })
  @Post('banners')
  createBanner(@Req() req: Request, @Body() dto: CreateStorefrontBannerDto) {
    return this.service.createBanner(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Update a banner' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StorefrontBannerResponseDto })
  @Patch('banners/:id')
  updateBanner(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateStorefrontBannerDto,
  ) {
    return this.service.updateBanner(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Delete a banner' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete('banners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBanner(@Req() req: Request, @Param('id') id: string) {
    return this.service.deleteBanner(req.user as AdminJwtPayload, id);
  }
}
