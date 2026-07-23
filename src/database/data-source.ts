import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate/run/revert).
 * Mirrors the runtime connection in database.module.ts but with
 * `synchronize: false` — schema changes go through migrations, never auto-sync.
 *
 *   npm run migration:generate -- src/database/migrations/<Name>
 *   npm run migration:run
 *   npm run migration:revert
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'omega',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  extra: { options: `-c timezone=${process.env.TZ || 'Africa/Lagos'}` },
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
