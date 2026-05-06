import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findByEmail(businessId: string, email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { businessId, email } });
  }

  async findByCustomerId(customerId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { customerId } });
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: {
    businessId: string;
    customerId: string;
    email: string;
    password: string;
  }): Promise<UserEntity> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async updateRefreshToken(id: string, hash: string | null): Promise<void> {
    await this.userRepo.update(id, { refreshTokenHash: hash });
  }

  async recordLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }
}
