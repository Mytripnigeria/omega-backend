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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { PrintersService } from './printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { FilterPrinterDto } from './dto/filter-printer.dto';

@UseGuards(JwtAuthGuard)
@Controller('printers')
export class PrintersController {
  constructor(private readonly service: PrintersService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query() query: FilterPrinterDto) {
    return this.service.list(businessId, query.storeId);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreatePrinterDto) {
    return this.service.create(businessId, dto);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrinterDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
