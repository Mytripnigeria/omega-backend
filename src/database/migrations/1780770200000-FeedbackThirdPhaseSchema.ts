import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feedback (third) phases 1–3 — catch-up migration for every schema change on
 * the feedback-third-phase1 branch that had no migration yet:
 *
 *  • orders: estimatedPrepMinutes / preparingStartedAt (kitchen countdown),
 *    preparingStaffId / preparingStaffName (who pressed Start Preparing)
 *  • cash_sessions: staffIdsJoined (register join)
 *  • business_settings: staffCodePrefix (merchant staff-code prefix, e.g. MJS)
 *  • workstation_settings: geofence on/off + lat/long + radius
 *  • ingredient_movements: fromLocationName / toLocationName (transfer + order
 *    consumption source display)
 *  • checklist_completions: per-staff per-item per-period completion rows
 *  • financial_transactions enums: guard 'payout' purpose + 'transfer' method
 *    (used by the payout → transactions-ledger mirror)
 *
 * Additive only and idempotent (IF NOT EXISTS everywhere) — safe over any
 * partial state left by earlier DB_SYNC=true runs.
 */
export class FeedbackThirdPhaseSchema1780770200000
  implements MigrationInterface
{
  name = 'FeedbackThirdPhaseSchema1780770200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── orders ────────────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimatedPrepMinutes" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "preparingStartedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "preparingStaffId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "preparingStaffName" character varying`,
    );

    // ── cash_sessions ─────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "staffIdsJoined" text`,
    );

    // ── business_settings ─────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "staffCodePrefix" character varying(6) NOT NULL DEFAULT 'STF'`,
    );

    // ── workstation_settings (geofencing) ─────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "geofenceEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "geofenceLatitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "geofenceLongitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "workstation_settings" ADD COLUMN IF NOT EXISTS "geofenceRadiusMeters" integer NOT NULL DEFAULT 100`,
    );

    // ── ingredient_movements ──────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "ingredient_movements" ADD COLUMN IF NOT EXISTS "fromLocationName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingredient_movements" ADD COLUMN IF NOT EXISTS "toLocationName" character varying`,
    );

    // ── checklist_completions ─────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "checklist_completions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "checklistId" uuid NOT NULL,
        "staffId" uuid NOT NULL,
        "staffName" character varying,
        "itemId" character varying NOT NULL,
        "periodKey" character varying NOT NULL,
        "completedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_checklist_completion_period" UNIQUE ("checklistId", "staffId", "itemId", "periodKey"),
        CONSTRAINT "PK_checklist_completions_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_checklist_completions_checklist" ON "checklist_completions" ("checklistId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_checklist_completions_period" ON "checklist_completions" ("checklistId", "periodKey")`,
    );

    // ── financial_transactions enum guards ────────────────────────────────
    // ADD VALUE cannot run inside a transaction block on some PG versions.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(
      `ALTER TYPE "public"."financial_transactions_purpose_enum" ADD VALUE IF NOT EXISTS 'payout'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."financial_transactions_method_enum" ADD VALUE IF NOT EXISTS 'transfer'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_checklist_completions_period"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_checklist_completions_checklist"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "checklist_completions"`);
    await queryRunner.query(`ALTER TABLE "ingredient_movements" DROP COLUMN IF EXISTS "toLocationName"`);
    await queryRunner.query(`ALTER TABLE "ingredient_movements" DROP COLUMN IF EXISTS "fromLocationName"`);
    await queryRunner.query(`ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "geofenceRadiusMeters"`);
    await queryRunner.query(`ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "geofenceLongitude"`);
    await queryRunner.query(`ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "geofenceLatitude"`);
    await queryRunner.query(`ALTER TABLE "workstation_settings" DROP COLUMN IF EXISTS "geofenceEnabled"`);
    await queryRunner.query(`ALTER TABLE "business_settings" DROP COLUMN IF EXISTS "staffCodePrefix"`);
    await queryRunner.query(`ALTER TABLE "cash_sessions" DROP COLUMN IF EXISTS "staffIdsJoined"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "preparingStaffName"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "preparingStaffId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "preparingStartedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "estimatedPrepMinutes"`);
    // Postgres cannot drop enum values; leaving 'payout'/'transfer' is harmless.
  }
}
