import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Round 12 — Cloove order flow.
 *
 * "Send to kitchen" stopped being a lifecycle transition: an accepted order
 * stays PENDING (it is already on the kitchen board, waiting for a cook to
 * start preparing) and the counter's hand-over is recorded here instead. On a
 * Cloove order the same press moves Cloove's kitchen ticket to `queued`, which
 * is the stage the merchant's flow calls for at that point.
 */
export class CloveKitchenSync1792500000000 implements MigrationInterface {
  name = 'CloveKitchenSync1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sentToKitchenAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Orders that already went through the kitchen predate the column; anchor
    // them to when prep started so the counter does not re-offer the button
    // for work the kitchen has plainly already had.
    await queryRunner.query(
      `UPDATE "orders" SET "sentToKitchenAt" = "preparingStartedAt" ` +
        `WHERE "sentToKitchenAt" IS NULL AND "preparingStartedAt" IS NOT NULL`,
    );

    // How far back the Cloove order pull must keep looking: an order seen
    // unpaid has to stay inside the window until it is paid, or the door that
    // exists for merchants without a working webhook would miss it.
    await queryRunner.query(
      `ALTER TABLE "clove_integrations" ADD COLUMN IF NOT EXISTS "oldestUnsettledOrderAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clove_integrations" DROP COLUMN IF EXISTS "oldestUnsettledOrderAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "sentToKitchenAt"`,
    );
  }
}
