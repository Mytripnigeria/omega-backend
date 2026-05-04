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
import { VariationGroupsService } from './variation-groups.service';
import { CreateVariationGroupDto } from './dto/create-variation-group.dto';
import { UpdateVariationGroupDto } from './dto/update-variation-group.dto';
import { FilterVariationGroupDto } from './dto/filter-variation-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('variation-groups')
export class VariationGroupsController {
  constructor(private readonly service: VariationGroupsService) {}

  @Post()
  create(@Body() dto: CreateVariationGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: FilterVariationGroupDto) {
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
  update(@Param('id') id: string, @Body() dto: UpdateVariationGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
