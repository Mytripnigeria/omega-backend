import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { AdminEntity } from '../modules/admin/entities/admin.entity';
import { BusinessEntity } from '../modules/business/entities/business.entity';
import { BusinessSettingsEntity } from '../modules/business/entities/business-settings.entity';
import { StoreEntity } from '../modules/store/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get<boolean>('database.logging'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature([AdminEntity, BusinessEntity, BusinessSettingsEntity, StoreEntity]),
  ],
  providers: [SeedService],
})
export class DatabaseModule {}
