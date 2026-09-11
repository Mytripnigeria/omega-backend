import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Round-11 feedback schema.
 *
 * 1. Marketplace orders now carry the rider running the delivery leg. Chowdeck
 *    and Cloove dispatch their own riders, so there is no staff row to point
 *    at and the contact details have to be snapshotted on the order.
 * 2. `customers.source` gains the two marketplace channels, so a customer
 *    created from an incoming Chowdeck/Cloove order is attributed to where
 *    they actually came from instead of being lumped into "other".
 */
export class FeedbackEleventhSchema1792000000000 implements MigrationInterface {
  name = 'FeedbackEleventhSchema1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "riderName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "riderPhone" character varying`,
    );

    // ADD VALUE cannot run inside a transaction block on older PostgreSQL and
    // is not reversible, hence IF NOT EXISTS and the no-op `down` below.
    await queryRunner.query(
      `ALTER TYPE "customers_source_enum" ADD VALUE IF NOT EXISTS 'chowdeck'`,
    );
    await queryRunner.query(
      `ALTER TYPE "customers_source_enum" ADD VALUE IF NOT EXISTS 'clove'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "riderPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "riderName"`,
    );
    // Enum values are deliberately left in place: PostgreSQL cannot drop one,
    // and rows may already reference them.
  }
}
