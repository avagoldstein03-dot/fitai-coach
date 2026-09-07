import { toDateKey, sumValueByDay, sumMinutesByDay } from "./health-aggregation";

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date("2026-03-05T14:30:00.000Z"))).toBe("2026-03-05");
  });
});

describe("sumValueByDay", () => {
  it("sums values grouped by the calendar day they started on", () => {
    const result = sumValueByDay([
      { start: new Date("2026-03-05T08:00:00.000Z"), value: 3000 },
      { start: new Date("2026-03-05T18:00:00.000Z"), value: 2000 },
      { start: new Date("2026-03-06T08:00:00.000Z"), value: 1500 },
    ]);

    expect(result.get("2026-03-05")).toBe(5000);
    expect(result.get("2026-03-06")).toBe(1500);
    expect(result.size).toBe(2);
  });

  it("returns an empty map for no entries", () => {
    expect(sumValueByDay([]).size).toBe(0);
  });
});

describe("sumMinutesByDay", () => {
  it("sums interval durations in minutes, grouped by start day", () => {
    const result = sumMinutesByDay([
      { start: new Date("2026-03-05T23:00:00.000Z"), end: new Date("2026-03-05T23:30:00.000Z") },
      { start: new Date("2026-03-05T23:45:00.000Z"), end: new Date("2026-03-06T00:15:00.000Z") },
    ]);

    // Both intervals are keyed by their *start* day (2026-03-05), even though
    // the second one crosses midnight into 2026-03-06 — matches the existing
    // HealthKit behavior this mirrors.
    expect(result.get("2026-03-05")).toBeCloseTo(60, 5);
    expect(result.size).toBe(1);
  });

  it("returns an empty map for no intervals", () => {
    expect(sumMinutesByDay([]).size).toBe(0);
  });
});
