import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessEntity } from '../modules/business/entities/business.entity';
import { BusinessSettingsEntity } from '../modules/business/entities/business-settings.entity';
import { AdminEntity } from '../modules/admin/entities/admin.entity';
import { StoreEntity, WeeklyHours } from '../modules/store/entities/store.entity';

const DEFAULT_HOURS: WeeklyHours = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '10:00', close: '22:00', closed: false },
  sunday: { open: '11:00', close: '20:00', closed: false },
};

/**
 * Idempotent first-run seeder. On boot, if there are zero admins, creates:
 *   1. A Business (from SEED_BUSINESS_NAME or 'Mr. Jollof')
 *   2. A first Store under that business (from SEED_STORE_NAME or 'Main Store')
 *   3. An owner Admin (from SEED_ADMIN_EMAIL/PASSWORD/NAME, with sensible defaults)
 *   4. The matching BusinessSettings row.
 *
 * Disable with SEED_ON_BOOT=false. Re-runs are no-ops once at least one admin exists.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(AdminEntity)
    private readonly adminRepo: Repository<AdminEntity>,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get<string>('SEED_ON_BOOT') ?? process.env.SEED_ON_BOOT;
    if (enabled === 'false') return;

    const existing = await this.adminRepo.count();
    if (existing > 0) {
      this.logger.log(`Skipping seed — ${existing} admin(s) already exist`);
      return;
    }

    const businessName =
      this.configService.get<string>('SEED_BUSINESS_NAME') ??
      process.env.SEED_BUSINESS_NAME ??
      'Mr. Jollof';
    const storeName =
      this.configService.get<string>('SEED_STORE_NAME') ??
      process.env.SEED_STORE_NAME ??
      'Main Store';
    const storeAddress =
      this.configService.get<string>('SEED_STORE_ADDRESS') ??
      process.env.SEED_STORE_ADDRESS ??
      '1 Main Street, Lagos';
    const storePhone =
      this.configService.get<string>('SEED_STORE_PHONE') ?? process.env.SEED_STORE_PHONE ?? '+2348000000000';
    const storeEmail =
      this.configService.get<string>('SEED_STORE_EMAIL') ??
      process.env.SEED_STORE_EMAIL ??
      'main@mrjollof.com';
    const adminEmail =
      this.configService.get<string>('SEED_ADMIN_EMAIL') ??
      process.env.SEED_ADMIN_EMAIL ??
      'owner@mrjollof.com';
    const adminPassword =
      this.configService.get<string>('SEED_ADMIN_PASSWORD') ??
      process.env.SEED_ADMIN_PASSWORD ??
      'ChangeMe123!';
    const adminName =
      this.configService.get<string>('SEED_ADMIN_NAME') ??
      process.env.SEED_ADMIN_NAME ??
      'Owner';

    try {
      await this.dataSource.transaction(async (manager) => {
        const businessRepo = manager.getRepository(BusinessEntity);
        const settingsRepo = manager.getRepository(BusinessSettingsEntity);
        const storeRepo = manager.getRepository(StoreEntity);
        const adminRepo = manager.getRepository(AdminEntity);

        const business = await businessRepo.save(
          businessRepo.create({
            name: businessName,
            currency: 'NGN',
            timezone: 'Africa/Lagos',
            email: adminEmail,
          }),
        );

        await settingsRepo.save(settingsRepo.create({ businessId: business.id }));

        await storeRepo.save(
          storeRepo.create({
            businessId: business.id,
            name: storeName,
            address: storeAddress,
            phone: storePhone,
            email: storeEmail,
            timezone: 'Africa/Lagos',
            openingHours: DEFAULT_HOURS,
            isActive: true,
          }),
        );

        await adminRepo.save(
          adminRepo.create({
            businessId: business.id,
            fullName: adminName,
            email: adminEmail,
            password: adminPassword, // hashed by the @BeforeInsert hook
            role: 'owner',
            isActive: true,
          }),
        );
      });

      this.logger.log('=================================================================');
      this.logger.log(`Seed complete — created Business "${businessName}", Store "${storeName}"`);
      this.logger.log(`Owner login: ${adminEmail} / ${adminPassword}`);
      this.logger.log(
        adminPassword === 'ChangeMe123!'
          ? '⚠ Default password in use — change it immediately or set SEED_ADMIN_PASSWORD'
          : '(set via SEED_ADMIN_PASSWORD)',
      );
      this.logger.log('=================================================================');
    } catch (err) {
      this.logger.error(`Seed failed: ${(err as Error).message}`, (err as Error).stack);
    }
  }
}
