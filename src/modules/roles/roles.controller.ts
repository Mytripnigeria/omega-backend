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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleFilterDto } from './dto/role-filter.dto';
import { RoleResponseDto } from './dto/role-response.dto';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({
    summary: 'List available permissions',
    description: 'Returns the master list of all permission strings recognised by the system. Use these as valid values when creating or updating roles.',
  })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['view_products', 'manage_orders', 'manage_staff', 'view_reports'],
    },
  })
  @Get('permissions')
  getPermissions() {
    return this.rolesService.getPermissions();
  }

  @ApiOperation({ summary: 'Create a role', description: 'Admin-only. Creates a staff role with a permission set.' })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @ApiOperation({ summary: 'List roles', description: 'Returns roles for the given store.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/RoleResponseDto' } },
        total: { type: 'integer', example: 5 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        totalPages: { type: 'integer', example: 1 },
      },
    },
  })
  @Get()
  findAll(@Query() filter: RoleFilterDto) {
    return this.rolesService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single role' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RoleResponseDto })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a role', description: 'Admin-only. Partial update.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RoleResponseDto })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a role', description: 'Admin-only. Fails if staff members are still assigned to this role.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
