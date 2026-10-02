import { orderExercises, orderWeek, inferMovementType } from "./workout-ordering";
import type { WorkoutPlanExercise } from "@/services/ai-provider";

const ex = (
  exerciseName: string,
  extra: Partial<WorkoutPlanExercise> = {}
): WorkoutPlanExercise => ({ exerciseName, sets: 3, reps: "8-12", restSeconds: 60, ...extra });

const names = (list: WorkoutPlanExercise[]) => list.map((e) => e.exerciseName);

describe("inferMovementType", () => {
  it.each([
    ["Barbell Back Squat", "compound"],
    ["Romanian Deadlift", "compound"],
    ["Barbell Hip Thrust", "compound"],
    ["Bulgarian Split Squat", "compound"],
    ["Seated Cable Row", "compound"],
    ["Lat Pulldown", "compound"],
    ["Leg Press", "compound"],
  ])("reads %s as compound", (name, expected) => {
    expect(inferMovementType(name)).toBe(expected);
  });

  it.each([
    ["Leg Extension", "isolation"],
    ["Lying Leg Curl", "isolation"],
    ["Cable Glute Kickback", "isolation"],
    ["Lateral Raise", "isolation"],
    ["Standing Calf Raise", "isolation"],
    ["Triceps Pushdown", "isolation"],
    ["Face Pull", "isolation"],
  ])("reads %s as isolation", (name, expected) => {
    expect(inferMovementType(name)).toBe(expected);
  });

  it("does not mistake a leg curl for a compound hinge", () => {
    expect(inferMovementType("Lying Leg Curl")).toBe("isolation");
  });

  it("reports unknown rather than guessing", () => {
    expect(inferMovementType("Reverse Nordic Thing")).toBe("unknown");
  });
});

describe("orderExercises", () => {
  it("puts the goal-serving compound first — the reported bug", () => {
    // What the model actually produced for a client asking for glutes.
    const day = [
      ex("Barbell Back Squat"),
      ex("Leg Press"),
      ex("Barbell Hip Thrust", { isPriority: true }),
      ex("Cable Glute Kickback", { isPriority: true }),
      ex("Standing Calf Raise"),
    ];
    expect(names(orderExercises(day))).toEqual([
      "Barbell Hip Thrust",
      "Barbell Back Squat",
      "Leg Press",
      "Cable Glute Kickback",
      "Standing Calf Raise",
    ]);
  });

  it("puts every compound before every isolation", () => {
    const day = [
      ex("Leg Extension"),
      ex("Barbell Back Squat"),
      ex("Lateral Raise"),
      ex("Romanian Deadlift"),
    ];
    expect(names(orderExercises(day))).toEqual([
      "Barbell Back Squat",
      "Romanian Deadlift",
      "Leg Extension",
      "Lateral Raise",
    ]);
  });

  it("keeps the model's order within a tier", () => {
    const day = [ex("Seated Cable Row"), ex("Bench Press"), ex("Lat Pulldown")];
    expect(names(orderExercises(day))).toEqual(["Seated Cable Row", "Bench Press", "Lat Pulldown"]);
  });

  it("prefers an explicit movementType over the name", () => {
    const day = [
      ex("Leg Extension", { movementType: "compound" }),
      ex("Barbell Back Squat", { movementType: "isolation" }),
    ];
    expect(names(orderExercises(day))).toEqual(["Leg Extension", "Barbell Back Squat"]);
  });

  it("sends cardio and mobility to the end, mobility last", () => {
    const day = [
      ex("Treadmill Intervals", { category: "cardio" }),
      ex("Hip Flexor Stretch", { category: "mobility" }),
      ex("Leg Extension"),
      ex("Barbell Back Squat"),
    ];
    expect(names(orderExercises(day))).toEqual([
      "Barbell Back Squat",
      "Leg Extension",
      "Treadmill Intervals",
      "Hip Flexor Stretch",
    ]);
  });

  it("ranks a priority isolation above a non-priority one", () => {
    const day = [ex("Lateral Raise"), ex("Cable Glute Kickback", { isPriority: true })];
    expect(names(orderExercises(day))).toEqual(["Cable Glute Kickback", "Lateral Raise"]);
  });

  it("does not mutate its input", () => {
    const day = [ex("Leg Extension"), ex("Barbell Back Squat")];
    const before = names(day);
    orderExercises(day);
    expect(names(day)).toEqual(before);
  });

  it("handles an empty day", () => {
    expect(orderExercises([])).toEqual([]);
  });
});

describe("orderWeek", () => {
  it("orders every day in the week", () => {
    const week = {
      weekNumber: 1,
      progressionStrategy: "base",
      days: [
        { dayOfWeek: 0, exercises: [ex("Leg Extension"), ex("Barbell Back Squat")] },
        { dayOfWeek: 2, exercises: [ex("Lateral Raise"), ex("Bench Press")] },
      ],
    };
    const out = orderWeek(week);
    expect(names(out.days[0].exercises)).toEqual(["Barbell Back Squat", "Leg Extension"]);
    expect(names(out.days[1].exercises)).toEqual(["Bench Press", "Lateral Raise"]);
    // original untouched
    expect(names(week.days[0].exercises)).toEqual(["Leg Extension", "Barbell Back Squat"]);
  });
});
