import type { ApRecurrence } from "./types";

// Dates are plain "YYYY-MM-DD" strings throughout — parsed/formatted in UTC so
// a date never shifts by a day depending on the browser's local timezone.

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Generates the recurrence series from startDate through throughDate
// (inclusive), skipping any date in skipDates. Monthly recurrence keeps the
// same day-of-month; per JS Date semantics, a start date late in a month
// (e.g. the 31st) can land on an earlier day in shorter months — a known,
// accepted quirk rather than a bug, worth knowing before picking a start date.
export function generateApDates(
  startDate: string,
  recurrence: ApRecurrence,
  throughDate: string,
  skipDates: string[] = []
): string[] {
  const skip = new Set(skipDates);
  const through = parseIsoDate(throughDate);
  const cur = parseIsoDate(startDate);
  const dates: string[] = [];

  while (cur.getTime() <= through.getTime()) {
    const iso = formatIsoDate(cur);
    if (!skip.has(iso)) dates.push(iso);

    if (recurrence === "weekly") cur.setUTCDate(cur.getUTCDate() + 7);
    else if (recurrence === "biweekly") cur.setUTCDate(cur.getUTCDate() + 14);
    else cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  return dates;
}

// Merges newly generated dates into the existing list without ever dropping
// an already-generated date — extending the window (or re-generating after a
// recurrence tweak) must never retroactively invalidate a date some
// transaction row has already been assigned to.
export function mergeGeneratedDates(existing: string[], toAdd: string[]): string[] {
  return Array.from(new Set([...existing, ...toAdd])).sort();
}

// The full set of dates that should be offered in an AP-date dropdown for a
// client — generated dates plus one-off extras, minus anything skipped.
// Mirrors the same computation done server-side in write-field/route.ts;
// keep the two in sync if this logic changes.
export function effectiveApDates(generatedDates: string[], extraDates: string[], skipDates: string[]): string[] {
  const skip = new Set(skipDates);
  return Array.from(new Set([...generatedDates, ...extraDates])).filter(d => !skip.has(d)).sort();
}

export function addMonthsIso(iso: string, months: number): string {
  const d = parseIsoDate(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return formatIsoDate(d);
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}
