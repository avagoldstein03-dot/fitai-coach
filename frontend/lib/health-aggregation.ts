// Shared, platform-agnostic math used by both health.ios.ts (HealthKit) and
// health.android.ts (Health Connect) — the one genuinely testable seam in
// either integration, since the actual native API calls aren't unit-testable.

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Sums a value (e.g. step count, active-energy kcal) per calendar day, keyed
// by the day the interval started on.
export function sumValueByDay(entries: Array<{ start: Date; value: number }>): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const key = toDateKey(entry.start);
    byDay.set(key, (byDay.get(key) ?? 0) + entry.value);
  }
  return byDay;
}

// Sums asleep-minutes per calendar day from a list of asleep intervals —
// callers are responsible for filtering out awake/in-bed-but-not-asleep
// stages first, since HealthKit and Health Connect use different numeric
// stage enums.
export function sumMinutesByDay(intervals: Array<{ start: Date; end: Date }>): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const { start, end } of intervals) {
    const key = toDateKey(start);
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    byDay.set(key, (byDay.get(key) ?? 0) + minutes);
  }
  return byDay;
}
