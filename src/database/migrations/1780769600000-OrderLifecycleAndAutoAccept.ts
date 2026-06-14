import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1A/1B — order lifecycle additions:
 *  • adds 'initiated' and 'delivering' values to the orders status enum
 *  • changes the orders.status default to 'initiated' (new orders await
 *    acceptance in the counter POS)
 *  • adds workstation_settings.autoAcceptOrders (auto-accept toggle)
 *
 * Idempotent: enum ADD VALUE uses IF NOT EXISTS and the column add is guarded.
 * Additive only — no data-bearing column is dropped, existing orders keep
 * their current status.
 */
export class OrderLifecycleAndAutoAccept1780769600000
  implements MigrationInterface
{
  name = 'OrderLifecycleAndAutoAccept1780769600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New enum values. ADD VALUE cannot run inside a transaction block on some
    // PG versions, so commit any open tx first, then add idempotently.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `ALTER TYPE "public"."orders_status_enum" ADD VALUE IF NOT EXISTS 'initiated'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."orders_status_enum" ADD VALUE IF NOT EXISTS 'delivering'`,
    );

    // New orders default to 'initiated'.
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'initiated'`,
    );

    // Auto-accept toggle on workstation settings.
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "autoAcceptOrders" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "autoAcceptOrders"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    // Postgres cannot drop individual enum values without recreating the type;
    // leaving 'initiated'/'delivering' in place is harmless on revert.
  }
}
