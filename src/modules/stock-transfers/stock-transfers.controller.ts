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
import { AdminJwtPayload } from '../../common/types/jwt-payload.types';
import { StockTransfersService } from './stock-transfers.service';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
  StockTransferFilterDto,
  UpdateStockTransferDto,
} from './dto/stock-transfer.dto';
import { StockTransferResponseDto } from './dto/stock-transfer-response.dto';

@ApiTags('stock-transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock-transfers')
export class StockTransfersController {
  constructor(private readonly service: StockTransfersService) {}

  @ApiOperation({ summary: 'List stock transfers' })
  @Get()
  list(@Query() filter: StockTransferFilterDto) {
    return this.service.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a stock transfer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StockTransferResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create a stock transfer' })
  @ApiCreatedResponse({ type: StockTransferResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateStockTransferDto) {
    return this.service.create(req.user as AdminJwtPayload, dto);
  }

  @ApiOperation({ summary: 'Update a stock transfer (pending only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StockTransferResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockTransferDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({
    summary: 'Approve a stock transfer',
    description:
      'Marks the transfer as in-transit and decrements source ingredient stock.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StockTransferResponseDto })
  @Post(':id/approve')
  approve(@Req() req: Request, @Param('id') id: string) {
    return this.service.approve(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({
    summary: 'Receive a stock transfer',
    description:
      'Marks the transfer as received and credits each line item to the destination ingredient stock.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StockTransferResponseDto })
  @Post(':id/receive')
  receive(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
  ) {
    return this.service.receive(req.user as AdminJwtPayload, id, dto);
  }

  @ApiOperation({ summary: 'Cancel a stock transfer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StockTransferResponseDto })
  @Post(':id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.service.cancel(req.user as AdminJwtPayload, id);
  }

  @ApiOperation({ summary: 'Delete a pending stock transfer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
