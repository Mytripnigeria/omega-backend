/**
 * Date-range filter helpers.
 *
 * Every list endpoint takes `dateFrom` / `dateTo`, validated with
 * `@IsDateString()` — which accepts BOTH a bare `2026-05-31` and a full ISO
 * `2026-05-31T23:59:59.000Z`. The old code built the upper bound by string
 * concatenation (`` `${filter.dateTo} 23:59:59` ``), which produces the
 * nonsense literal `2026-05-31T23:59:59.000Z 23:59:59` for the ISO form and
 * makes Postgres raise `22007 invalid input syntax for type timestamp` — an
 * unhandled 500 (this was the "Payouts: internal server error").
 *
 * These helpers accept either form and return a real Date, so the driver binds
 * a proper timestamp. Day boundaries are resolved in the process timezone,
 * which is pinned to the merchant's zone in src/timezone.ts — so "up to
 * 31 May" means end of 31 May in Nigeria, not in UTC.
 */

/** Start of `value`'s day (00:00:00.000), or undefined when unparseable. */
export function startOfDayFilter(
  value: string | undefined | null,
): Date | undefined {
  const d = parse(value);
  if (!d) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * End of `value`'s day (23:59:59.999), or undefined when unparseable.
 * A full ISO timestamp is still widened to the end of its day, matching the
 * inclusive "up to and including this date" semantics the UI date pickers use.
 */
export function endOfDayFilter(
  value: string | undefined | null,
): Date | undefined {
  const d = parse(value);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * `YYYY-MM-DD` for the *local* calendar day of `d` (the process timezone, which
 * src/timezone.ts pins to the merchant's zone).
 *
 * Never use `toISOString().slice(0, 10)` for a day label: Postgres buckets days
 * with `DATE_TRUNC` in the session timezone, so a Nigerian day starts at
 * `00:00+01:00` — which `toISOString()` renders as `23:00Z` on the *previous*
 * date. That is why the dashboard chart showed 08-05 on 08-06.
 */
export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * `YYYY-MM-DDTHH:mm:ss` for the local wall clock of `d`, with no timezone
 * suffix — so `new Date(value)` in the browser parses it back as local time and
 * `getHours()` returns the hour the merchant actually traded in.
 *
 * Hour buckets previously collapsed to a bare `YYYY-MM-DD`, which every hour of
 * the day shared; the UI parsed that as UTC midnight and rendered every bar as
 * "1am" in Lagos.
 */
export function localDateTimeKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${localDateKey(d)}T${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function parse(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  // A bare YYYY-MM-DD parses as UTC midnight in JS; read it as a local calendar
  // date instead so the day boundary lands in the merchant's timezone.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
