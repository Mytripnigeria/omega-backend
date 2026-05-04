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
import { BusinessId } from '../../common/decorators/business-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('variation-groups')
export class VariationGroupsController {
  constructor(private readonly service: VariationGroupsService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateVariationGroupDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: FilterVariationGroupDto) {
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
    @Body() dto: UpdateVariationGroupDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
