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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { StoreResponseDto } from './dto/store-response.dto';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @ApiOperation({
    summary: 'Create a store',
    description: 'Admin-only. Creates a new store (physical location) for the authenticated business.',
  })
  @ApiCreatedResponse({ type: StoreResponseDto })
  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateStoreDto) {
    return this.storeService.create(businessId, dto);
  }

  @ApiOperation({
    summary: 'List stores',
    description: 'Returns paginated stores for the authenticated business.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/StoreResponseDto' } },
        total: { type: 'integer', example: 3 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: PaginationQueryDto) {
    return this.storeService.findAll(businessId, query);
  }

  @ApiOperation({ summary: 'Get a single store' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StoreResponseDto })
  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.storeService.findOne(businessId, id);
  }

  @ApiOperation({ summary: 'Update a store', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StoreResponseDto })
  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storeService.update(businessId, id, dto);
  }

  @ApiOperation({ summary: 'Soft-delete a store', description: 'Admin-only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.storeService.remove(businessId, id);
  }
}
