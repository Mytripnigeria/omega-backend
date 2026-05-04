import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddOnGroupsService } from './addon-groups.service';
import { CreateAddOnGroupDto, CreateAddOnDto } from './dto/create-addon-group.dto';
import { UpdateAddOnGroupDto, UpdateAddOnDto } from './dto/update-addon-group.dto';
import { FilterAddOnGroupDto } from './dto/filter-addon-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('addon-groups')
export class AddOnGroupsController {
  constructor(private readonly service: AddOnGroupsService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateAddOnGroupDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: FilterAddOnGroupDto) {
    return this.service.findAll(businessId, query);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAddOnGroupDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }

  @Post(':id/addons')
  addAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: CreateAddOnDto,
  ) {
    return this.service.addAddon(businessId, id, dto);
  }

  @Patch(':id/addons/:addonId')
  updateAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateAddOnDto,
  ) {
    return this.service.updateAddon(businessId, id, addonId, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddon(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.service.removeAddon(businessId, id, addonId);
  }

  @Patch(':id/addons/:addonId/availability')
  toggleAvailability(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.service.toggleAvailability(businessId, id, addonId);
  }
}
