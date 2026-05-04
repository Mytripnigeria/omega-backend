import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminEntity } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepo: Repository<AdminEntity>,
  ) {}

  async create(dto: CreateAdminDto): Promise<Omit<AdminEntity, 'password' | 'refreshToken' | 'hashPassword'>> {
    const existing = await this.adminRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const admin = this.adminRepo.create(dto);
    const saved = await this.adminRepo.save(admin);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, hashPassword, ...result } = saved;
    return result;
  }

  async findByEmail(email: string): Promise<AdminEntity | null> {
    return this.adminRepo
      .createQueryBuilder('a')
      .addSelect('a.password')
      .where('a.email = :email', { email })
      .andWhere('a.isActive = true')
      .getOne();
  }

  async findById(id: string): Promise<AdminEntity> {
    const admin = await this.adminRepo.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async updateRefreshToken(id: string, hashedToken: string | null): Promise<void> {
    await this.adminRepo.update(id, { refreshToken: hashedToken ?? undefined });
  }

  async findByIdWithRefreshToken(id: string): Promise<AdminEntity | null> {
    return this.adminRepo
      .createQueryBuilder('a')
      .addSelect('a.refreshToken')
      .where('a.id = :id', { id })
      .getOne();
  }
}
