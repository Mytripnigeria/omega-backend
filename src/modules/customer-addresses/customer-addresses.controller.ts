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
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';
import { CustomerAddressesService } from './customer-addresses.service';
import {
  CreateCustomerAddressDto,
  CustomerAddressResponseDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';

@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(UserJwtGuard)
@Controller('storefront/me/addresses')
export class CustomerAddressesController {
  constructor(private readonly service: CustomerAddressesService) {}

  @ApiOperation({ summary: 'List my addresses' })
  @ApiOkResponse({ type: [CustomerAddressResponseDto] })
  @Get()
  list(@Req() req: Request) {
    const user = req.user as UserJwtPayload;
    return this.service.list(user.businessId, user.customerId);
  }

  @ApiOperation({ summary: 'Get an address by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerAddressResponseDto })
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as UserJwtPayload;
    return this.service.findOne(user.businessId, user.customerId, id);
  }

  @ApiOperation({ summary: 'Create an address' })
  @ApiCreatedResponse({ type: CustomerAddressResponseDto })
  @Post()
  create(@Req() req: Request, @Body() dto: CreateCustomerAddressDto) {
    const user = req.user as UserJwtPayload;
    return this.service.create(user.businessId, user.customerId, dto);
  }

  @ApiOperation({ summary: 'Update an address' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerAddressResponseDto })
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    const user = req.user as UserJwtPayload;
    return this.service.update(user.businessId, user.customerId, id, dto);
  }

  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as UserJwtPayload;
    return this.service.remove(user.businessId, user.customerId, id);
  }
}
