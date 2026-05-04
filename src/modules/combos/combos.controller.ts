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
import { CombosService } from './combos.service';
import { CreateComboDto, CreateComboItemDto } from './dto/create-combo.dto';
import { UpdateComboDto, ToggleComboStatusDto } from './dto/update-combo.dto';
import { UpdateComboItemDto } from './dto/update-combo-item.dto';
import { FilterComboDto } from './dto/filter-combo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('combos')
export class CombosController {
  constructor(private readonly combosService: CombosService) {}

  @Post()
  create(@Body() dto: CreateComboDto) {
    return this.combosService.create(dto);
  }

  @Get()
  findAll(@Query() query: FilterComboDto) {
    return this.combosService.findAll(query);
  }

  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.combosService.getStats(storeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.combosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateComboDto) {
    return this.combosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.combosService.remove(id);
  }

  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @Body() dto: ToggleComboStatusDto) {
    return this.combosService.toggleStatus(id, dto);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateComboItemDto) {
    return this.combosService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateComboItemDto,
  ) {
    return this.combosService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.combosService.removeItem(id, itemId);
  }
}
