import { calculateStreak, detectWorkoutPlateaus, diffBodyComposition, buildTrendsSummary } from "./trends";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

describe("calculateStreak", () => {
  it("returns 0 for an empty list", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const records = [{ createdAt: daysAgo(0) }, { createdAt: daysAgo(1) }, { createdAt: daysAgo(2) }];
    expect(calculateStreak(records)).toBe(3);
  });

  it("still counts the streak as active if the most recent session was yesterday", () => {
    const records = [{ createdAt: daysAgo(1) }];
    expect(calculateStreak(records)).toBe(1);
  });

  it("breaks the streak on a 2+ day gap", () => {
    const records = [{ createdAt: daysAgo(0) }, { createdAt: daysAgo(3) }];
    expect(calculateStreak(records)).toBe(1);
  });

  it("counts same-day duplicate records only once", () => {
    const today = daysAgo(0);
    const records = [{ createdAt: today }, { createdAt: today }, { createdAt: daysAgo(1) }];
    expect(calculateStreak(records)).toBe(2);
  });
});

describe("detectWorkoutPlateaus", () => {
  it("flags an exercise with 3+ identical recent sessions", () => {
    const sessions = [0, 1, 2].map((n) => ({
      exerciseName: "Bench Press",
      weight: 135,
      completedReps: "8",
      createdAt: daysAgo(n),
    }));
    const plateaus = detectWorkoutPlateaus(sessions);
    expect(plateaus).toHaveLength(1);
    expect(plateaus[0]).toMatchObject({ exerciseName: "Bench Press", weight: 135, sessionCount: 3 });
  });

  it("does not flag fewer than minStreak sessions", () => {
    const sessions = [0, 1].map((n) => ({
      exerciseName: "Squat",
      weight: 185,
      completedReps: "5",
      createdAt: daysAgo(n),
    }));
    expect(detectWorkoutPlateaus(sessions)).toHaveLength(0);
  });

  it("does not flag when weight or reps differ across sessions", () => {
    const sessions = [
      { exerciseName: "Deadlift", weight: 225, completedReps: "5", createdAt: daysAgo(0) },
      { exerciseName: "Deadlift", weight: 215, completedReps: "5", createdAt: daysAgo(1) },
      { exerciseName: "Deadlift", weight: 205, completedReps: "5", createdAt: daysAgo(2) },
    ];
    expect(detectWorkoutPlateaus(sessions)).toHaveLength(0);
  });

  it("handles multiple exercises independently", () => {
    const plateaued = [0, 1, 2].map((n) => ({
      exerciseName: "Overhead Press",
      weight: 95,
      completedReps: "6",
      createdAt: daysAgo(n),
    }));
    const progressing = [
      { exerciseName: "Row", weight: 135, completedReps: "8", createdAt: daysAgo(0) },
      { exerciseName: "Row", weight: 125, completedReps: "8", createdAt: daysAgo(1) },
    ];
    const plateaus = detectWorkoutPlateaus([...plateaued, ...progressing]);
    expect(plateaus.map((p) => p.exerciseName)).toEqual(["Overhead Press"]);
  });

  it("handles bodyweight exercises (weight: null)", () => {
    const sessions = [0, 1, 2].map((n) => ({
      exerciseName: "Push-ups",
      weight: null,
      completedReps: "20",
      createdAt: daysAgo(n),
    }));
    const plateaus = detectWorkoutPlateaus(sessions);
    expect(plateaus).toHaveLength(1);
    expect(plateaus[0].weight).toBeNull();
  });

  it("processes unsorted input correctly", () => {
    const sessions = [
      { exerciseName: "Curl", weight: 30, completedReps: "10", createdAt: daysAgo(1) },
      { exerciseName: "Curl", weight: 30, completedReps: "10", createdAt: daysAgo(0) },
      { exerciseName: "Curl", weight: 30, completedReps: "10", createdAt: daysAgo(2) },
    ];
    expect(detectWorkoutPlateaus(sessions)).toHaveLength(1);
  });
});

describe("diffBodyComposition", () => {
  it("diffs only keys present in both records", () => {
    const latest = { estimatedBodyFat: "18%", muscleDefinition: "moderate", estimatedBMI: "23" };
    const previous = { build: "athletic", muscleDefinition: "low" };
    const diffs = diffBodyComposition(latest, previous);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toContain("low");
    expect(diffs[0]).toContain("moderate");
  });

  it("returns an empty array when values are identical", () => {
    const record = { muscleDefinition: "moderate" };
    expect(diffBodyComposition(record, record)).toEqual([]);
  });

  it("returns an empty array when either input is null", () => {
    expect(diffBodyComposition(null, { a: "1" })).toEqual([]);
    expect(diffBodyComposition({ a: "1" }, null)).toEqual([]);
    expect(diffBodyComposition(undefined, undefined)).toEqual([]);
  });
});

describe("buildTrendsSummary", () => {
  it("returns an empty string when there is nothing notable", () => {
    expect(buildTrendsSummary({ plateaus: [], compositionDiffs: [] })).toBe("");
  });

  it("caps to the top 3 plateaus and top 3 diffs", () => {
    const plateaus = Array.from({ length: 5 }, (_, i) => ({
      exerciseName: `Exercise ${i}`,
      weight: 100,
      completedReps: "10",
      sessionCount: 3,
    }));
    const compositionDiffs = Array.from({ length: 5 }, (_, i) => `diff ${i}`);
    const summary = buildTrendsSummary({ plateaus, compositionDiffs });
    const lines = summary.split("\n");
    expect(lines).toHaveLength(6);
  });
});
