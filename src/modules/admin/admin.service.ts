import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminEntity } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { BusinessEntity } from '../business/entities/business.entity';

type SafeAdmin = Omit<
  AdminEntity,
  'password' | 'refreshToken' | 'twoFactorSecret' | 'twoFactorBackupCodes' | 'hashPassword'
>;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepo: Repository<AdminEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businessRepo: Repository<BusinessEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAdminDto): Promise<SafeAdmin> {
    const existing = await this.adminRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    return this.dataSource.transaction(async (manager) => {
      const businessRepo = manager.getRepository(BusinessEntity);
      const adminRepo = manager.getRepository(AdminEntity);

      // Each new admin gets their own business in v1.
      // Multi-admin-per-business invitations come via the team invite flow (separate path).
      const business = businessRepo.create({
        name: dto.fullName ? `${dto.fullName}'s Business` : 'My Business',
      });
      const savedBusiness = await businessRepo.save(business);

      const admin = adminRepo.create({ ...dto, businessId: savedBusiness.id });
      const saved = await adminRepo.save(admin);

      const {
        password,
        refreshToken,
        twoFactorSecret,
        twoFactorBackupCodes,
        hashPassword,
        ...result
      } = saved;
      void password;
      void refreshToken;
      void twoFactorSecret;
      void twoFactorBackupCodes;
      void hashPassword;
      return result as SafeAdmin;
    });
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

  async findByIdWithSecrets(id: string): Promise<AdminEntity | null> {
    return this.adminRepo
      .createQueryBuilder('a')
      .addSelect('a.password')
      .addSelect('a.twoFactorSecret')
      .addSelect('a.twoFactorBackupCodes')
      .where('a.id = :id', { id })
      .getOne();
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

  async listByBusiness(businessId: string): Promise<AdminEntity[]> {
    return this.adminRepo.find({
      where: { businessId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Clearing `mustChangePassword` here is the point of the flag: a staff member
   * granted dashboard access starts on a generated temporary password, and the
   * only thing that should retire it is actually choosing a new one.
   */
  async updatePassword(id: string, newHash: string): Promise<void> {
    await this.adminRepo.update(id, {
      password: newHash,
      mustChangePassword: false,
    });
  }

  async setTwoFactor(
    id: string,
    secret: string | null,
    enabled: boolean,
    backupCodes: string[] | null,
  ): Promise<void> {
    await this.adminRepo.update(id, {
      twoFactorSecret: secret as string,
      twoFactorEnabled: enabled,
      twoFactorBackupCodes: backupCodes as string[],
    });
  }
}
