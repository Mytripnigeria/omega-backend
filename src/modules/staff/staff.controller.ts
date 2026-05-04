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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('stats')
  getStats(@Query('storeId') storeId?: string) {
    return this.staffService.getStats(storeId);
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Get()
  findAll(@Query() filter: StaffFilterDto) {
    return this.staffService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }

  @Patch(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPin(@Param('id') id: string, @Body() dto: SetPinDto) {
    return this.staffService.setPin(id, dto);
  }

  @Delete(':id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearPin(@Param('id') id: string) {
    return this.staffService.clearPin(id);
  }

  @Post(':id/documents')
  addDocument(@Param('id') staffId: string, @Body() dto: AddDocumentDto) {
    return this.staffService.addDocument(staffId, dto);
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(@Param('id') staffId: string, @Param('docId') docId: string) {
    return this.staffService.removeDocument(staffId, docId);
  }
}
