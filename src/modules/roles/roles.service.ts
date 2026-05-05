import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleFilterDto } from './dto/role-filter.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

export const ALL_PERMISSIONS = [
  'orders.read',
  'orders.create',
  'orders.update',
  'orders.delete',
  'staff.read',
  'staff.create',
  'staff.update',
  'staff.delete',
  'roles.read',
  'roles.manage',
  'shifts.read',
  'shifts.manage',
  'payslips.read',
  'payslips.manage',
  'reports.view',
  'settings.manage',
  'kitchen.view',
  'inventory.read',
  'inventory.manage',
];

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const role = this.roleRepo.create(dto);
    const saved = await this.roleRepo.save(role);
    return RoleResponseDto.from({ ...saved, staffCount: 0 });
  }

  async findAll(filter: RoleFilterDto): Promise<PaginatedResponseDto<RoleResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.roleRepo
      .createQueryBuilder('r')
      .loadRelationCountAndMap('r.staffCount', 'r.staff')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC');

    if (filter.storeId) qb.andWhere('r.storeId = :storeId', { storeId: filter.storeId });
    if (filter.search) {
      qb.andWhere('r.name ILIKE :search', { search: `%${filter.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(
      data as (RoleEntity & { staffCount: number })[],
      total,
      page,
      limit,
      RoleResponseDto.from,
    );
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    return RoleResponseDto.from(await this.findOneEntity(id));
  }

  private async findOneEntity(id: string): Promise<RoleEntity & { staffCount: number }> {
    const qb = this.roleRepo
      .createQueryBuilder('r')
      .loadRelationCountAndMap('r.staffCount', 'r.staff')
      .where('r.id = :id', { id });

    const role = await qb.getOne();
    if (!role) throw new NotFoundException('Role not found');
    return role as RoleEntity & { staffCount: number };
  }

  async findByIdRaw(id: string): Promise<RoleEntity> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.findByIdRaw(id);
    Object.assign(role, dto);
    await this.roleRepo.save(role);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOneEntity(id);
    if (role.staffCount > 0) {
      throw new BadRequestException(
        'Cannot delete a role that has staff assigned to it',
      );
    }
    await this.roleRepo.delete(id);
  }

  getPermissions(): string[] {
    return ALL_PERMISSIONS;
  }
}
