import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1F — payment method channel visibility + Wallet type:
 *  • adds 'wallet' to the payment_methods type enum
 *  • adds payment_methods.visibility (simple-array of channels), defaulting to
 *    all channels so existing methods keep showing everywhere
 *
 * Idempotent and additive.
 */
export class PaymentMethodWalletAndVisibility1780769700000
  implements MigrationInterface
{
  name = 'PaymentMethodWalletAndVisibility1780769700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_methods_type_enum" ADD VALUE IF NOT EXISTS 'wallet'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'pos,self,storefront,omni'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "visibility"`,
    );
    // Enum value 'wallet' is left in place (Postgres can't drop enum values
    // without recreating the type); harmless on revert.
  }
}
