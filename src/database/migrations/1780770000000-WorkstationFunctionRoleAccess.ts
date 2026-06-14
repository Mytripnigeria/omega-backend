import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #67 — adds workstation_settings.functionRoleAccess (jsonb map of workstation
 * function → allowed role names) so merchants can restrict each workstation
 * function to specific roles. Additive and idempotent.
 */
export class WorkstationFunctionRoleAccess1780770000000
  implements MigrationInterface
{
  name = 'WorkstationFunctionRoleAccess1780770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "functionRoleAccess" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "functionRoleAccess"`,
    );
  }
}
