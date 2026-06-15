import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hotfix: the OrderStatusEventEntity.fromStatus/toStatus columns use their own
 * Postgres enums (order_status_events_fromstatus_enum / _tostatus_enum), which
 * were NOT updated when 'initiated'/'delivering' were added to the orders
 * status enum. That made order creation (writes a null→initiated event) and
 * the ready→delivering transition fail with 22P02. This adds the values to
 * both event enums. Idempotent.
 */
export class OrderStatusEventEnumValues1780770100000
  implements MigrationInterface
{
  name = 'OrderStatusEventEnumValues1780770100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ADD VALUE can't run inside a transaction block on some PG versions.
    await queryRunner.query(`COMMIT`);
    for (const enumName of [
      'order_status_events_tostatus_enum',
      'order_status_events_fromstatus_enum',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."${enumName}" ADD VALUE IF NOT EXISTS 'initiated'`,
      );
      await queryRunner.query(
        `ALTER TYPE "public"."${enumName}" ADD VALUE IF NOT EXISTS 'delivering'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Postgres can't drop enum values without recreating the type; harmless to keep.
  }
}
