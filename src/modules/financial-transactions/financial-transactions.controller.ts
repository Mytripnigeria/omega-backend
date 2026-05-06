import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtOrStaffGuard } from '../../common/guards/jwt-or-staff.guard';
import { JwtPayload } from '../../common/types/jwt-payload.types';
import { FinancialTransactionsService } from './financial-transactions.service';
import { FinancialTransactionFilterDto } from './dto/financial-transaction-filter.dto';
import {
  FinancialTransactionResponseDto,
  FinancialTransactionStatsDto,
} from './dto/financial-transaction-response.dto';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function actorFrom(req: AuthedRequest) {
  const user = req.user!;
  if (user.sub_type === 'staff') {
    return {
      sub: user.sub,
      sub_type: 'staff' as const,
      businessId: user.businessId,
      storeId: user.storeId,
    };
  }
  return {
    sub: user.sub,
    sub_type: 'admin' as const,
    businessId: user.businessId,
  };
}

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtOrStaffGuard)
@Controller('transactions')
export class FinancialTransactionsController {
  constructor(private readonly service: FinancialTransactionsService) {}

  @ApiOperation({
    summary: 'List financial transactions',
    description:
      'Returns a paginated ledger of all money movements across the business: ' +
      'order payments, refunds, wallet credits/debits, expense payouts. Staff are ' +
      'auto-scoped to their store.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/FinancialTransactionResponseDto' },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  })
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query() filter: FinancialTransactionFilterDto,
  ) {
    return this.service.findAll(actorFrom(req), filter);
  }

  @ApiOperation({
    summary: 'Transaction stats',
    description:
      'Total in / total out / pending balance for filtered period; breakdowns by method and purpose.',
  })
  @ApiOkResponse({ type: FinancialTransactionStatsDto })
  @Get('stats')
  stats(
    @Req() req: AuthedRequest,
    @Query() filter: FinancialTransactionFilterDto,
  ) {
    return this.service.getStats(actorFrom(req), filter);
  }

  @ApiOperation({ summary: 'Get a single transaction' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FinancialTransactionResponseDto })
  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    const tx = await this.service.findOne(actorFrom(req), id);
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }
}
