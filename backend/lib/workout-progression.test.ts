import { expandWeekWithProgression } from "./workout-progression";
import type { WorkoutPlanWeek } from "@/services/ai-provider";

const week1: WorkoutPlanWeek = {
  weekNumber: 1,
  progressionStrategy: "Establish baseline working weights across all lifts.",
  days: [
    {
      dayOfWeek: 0,
      exercises: [
        { exerciseName: "Barbell Back Squat", sets: 4, reps: "6-8", restSeconds: 90, notes: "Keep core braced." },
        { exerciseName: "Romanian Deadlift", sets: 3, reps: "8-10", restSeconds: 75 },
      ],
    },
    {
      dayOfWeek: 3,
      exercises: [
        { exerciseName: "Bench Press", sets: 4, reps: "6-8", restSeconds: 90 },
      ],
    },
  ],
};

describe("expandWeekWithProgression", () => {
  it("returns just week 1 unchanged for a 1-week program", () => {
    const weeks = expandWeekWithProgression(week1, 1);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toEqual(week1);
  });

  it("expands to the requested number of weeks", () => {
    const weeks = expandWeekWithProgression(week1, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4]);
  });

  it("keeps week 1 exactly as authored", () => {
    const weeks = expandWeekWithProgression(week1, 3);
    expect(weeks[0]).toEqual(week1);
  });

  it("preserves exercise selection, sets, reps, and rest across generated weeks", () => {
    const weeks = expandWeekWithProgression(week1, 3);
    for (const week of weeks.slice(1)) {
      expect(week.days).toHaveLength(week1.days.length);
      week.days.forEach((day, dayIdx) => {
        expect(day.dayOfWeek).toBe(week1.days[dayIdx].dayOfWeek);
        expect(day.exercises).toHaveLength(week1.days[dayIdx].exercises.length);
        day.exercises.forEach((ex, exIdx) => {
          const original = week1.days[dayIdx].exercises[exIdx];
          expect(ex.exerciseName).toBe(original.exerciseName);
          expect(ex.sets).toBe(original.sets);
          expect(ex.reps).toBe(original.reps);
          expect(ex.restSeconds).toBe(original.restSeconds);
        });
      });
    }
  });

  it("appends a progression cue to notes for generated weeks, preserving any original note", () => {
    const weeks = expandWeekWithProgression(week1, 2);
    const squatWeek2 = weeks[1].days[0].exercises[0];
    expect(squatWeek2.notes).toContain("Keep core braced.");
    expect(squatWeek2.notes).toContain("Week 2");
  });

  it("adds a progression cue even when the original exercise had no notes", () => {
    const weeks = expandWeekWithProgression(week1, 2);
    const rdlWeek2 = weeks[1].days[0].exercises[1];
    expect(rdlWeek2.notes).toContain("Week 2");
  });

  it("gives generated weeks a distinct progressionStrategy describing the overload rule", () => {
    const weeks = expandWeekWithProgression(week1, 2);
    expect(weeks[1].progressionStrategy).not.toBe(week1.progressionStrategy);
    expect(weeks[1].progressionStrategy.toLowerCase()).toContain("overload");
  });
});
