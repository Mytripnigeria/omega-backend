import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feedback (fourth) — schema for this round's changes:
 *
 *  • orders: ingredientsConsumedAt (recipe deductions now happen at first
 *    acceptance, guarded by this flag so completion/payment can't double-deduct)
 *  • deliveries: dispatchedAt / dispatchedByStaffId / dispatchedByName (waiter
 *    "Send for delivery" hand-off) + new 'awaiting_dispatch' status value —
 *    deliveries are created awaiting dispatch and only become rider-visible
 *    (pending) once the waiter dispatches them
 *
 * Additive only and idempotent (IF NOT EXISTS everywhere) — safe over any
 * partial state left by earlier DB_SYNC=true runs. The deliveries status enum
 * type name is resolved from the catalog (the table predates the migration
 * chain, so the type name can't be assumed).
 */
export class FeedbackFourthPhaseSchema1784500000000
  implements MigrationInterface
{
  name = 'FeedbackFourthPhaseSchema1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── orders ────────────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ingredientsConsumedAt" TIMESTAMP WITH TIME ZONE`,
    );

    // ── deliveries ────────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "deliveries" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "deliveries" ADD COLUMN IF NOT EXISTS "dispatchedByStaffId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "deliveries" ADD COLUMN IF NOT EXISTS "dispatchedByName" character varying`,
    );

    // ── deliveries status enum guard ──────────────────────────────────────
    // ADD VALUE cannot run inside a transaction block on some PG versions, so
    // commit first. The enum type name is looked up from the deliveries.status
    // column rather than hardcoded (the table was created by DB_SYNC, not a
    // migration, so the generated type name is unverified).
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_type text;
      BEGIN
        SELECT format('%I.%I', n.nspname, t.typname) INTO enum_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE c.relname = 'deliveries' AND a.attname = 'status' AND t.typtype = 'e';
        IF enum_type IS NOT NULL THEN
          EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', enum_type, 'awaiting_dispatch');
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS "deliveries" DROP COLUMN IF EXISTS "dispatchedByName"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "deliveries" DROP COLUMN IF EXISTS "dispatchedByStaffId"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "deliveries" DROP COLUMN IF EXISTS "dispatchedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "ingredientsConsumedAt"`);
    // Postgres cannot drop enum values; leaving 'awaiting_dispatch' is harmless.
  }
}
