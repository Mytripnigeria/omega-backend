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

@UseGuards(JwtAuthGuard)
@Controller('addon-groups')
export class AddOnGroupsController {
  constructor(private readonly service: AddOnGroupsService) {}

  @Post()
  create(@Body() dto: CreateAddOnGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: FilterAddOnGroupDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.service.getStats(storeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAddOnGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/addons')
  addAddon(@Param('id') id: string, @Body() dto: CreateAddOnDto) {
    return this.service.addAddon(id, dto);
  }

  @Patch(':id/addons/:addonId')
  updateAddon(
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateAddOnDto,
  ) {
    return this.service.updateAddon(id, addonId, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddon(@Param('id') id: string, @Param('addonId') addonId: string) {
    return this.service.removeAddon(id, addonId);
  }

  @Patch(':id/addons/:addonId/availability')
  toggleAvailability(@Param('id') id: string, @Param('addonId') addonId: string) {
    return this.service.toggleAvailability(id, addonId);
  }
}
