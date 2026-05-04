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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { FilterCategoryDto } from './dto/filter-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { BusinessContext } from '../../common/decorators/business-context.decorator';
import { CategoryType } from './entities/category.entity';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(businessId, dto);
  }

  @UseGuards(JwtOrStaffGuard)
  @Get()
  findAll(@BusinessContext() businessId: string, @Query() query: FilterCategoryDto) {
    return this.categoriesService.findAll(businessId, query);
  }

  @UseGuards(JwtOrStaffGuard)
  @Get('stats')
  getStats(
    @BusinessContext() businessId: string,
    @Query('type') type?: CategoryType,
  ) {
    return this.categoriesService.getStats(businessId, type);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorder(@BusinessId() businessId: string, @Body() dto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(businessId, dto);
  }

  @UseGuards(JwtOrStaffGuard)
  @Get(':id')
  findOne(@BusinessContext() businessId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(businessId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(businessId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.categoriesService.remove(businessId, id);
  }
}
