import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registers (#5/#70) — adds register-report fields to cash_sessions:
 *  • counterName (billing counter captured at open)
 *  • staffsJoined (CSV of staff who transacted on the register)
 * Additive and idempotent.
 */
export class CashSessionRegisterFields1780769800000
  implements MigrationInterface
{
  name = 'CashSessionRegisterFields1780769800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "counterName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "staffsJoined" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cash_sessions" DROP COLUMN IF EXISTS "staffsJoined"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_sessions" DROP COLUMN IF EXISTS "counterName"`,
    );
  }
}
