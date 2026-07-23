/**
 * Pins the process timezone to the merchant's wall clock (West Africa Time by
 * default) and must be the FIRST import in main.ts — TypeScript hoists `import`
 * statements above plain statements, so a bare `process.env.TZ = …` at the top
 * of main.ts would run after every module has already been evaluated.
 *
 * Why it matters: every server-side "today" boundary, opening-hours check,
 * time-slot generation and printed timestamp is computed with Node's local
 * time. On a UTC container those all sit an hour behind Nigeria, which is why
 * a 7:30am transaction was reported as 6:30am.
 *
 * Stored instants are unaffected — all timestamp columns are `timestamptz`, so
 * Postgres and node-postgres exchange absolute points in time regardless of
 * either side's session timezone.
 */
process.env.TZ = process.env.APP_TIMEZONE || 'Africa/Lagos';

export const APP_TIMEZONE = process.env.TZ;
