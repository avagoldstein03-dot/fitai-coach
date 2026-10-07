import { orderExercises, orderWeek, ensureCoreCircuit, inferMovementType } from "./workout-ordering";
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

  it("keeps the ab circuit together after the main work", () => {
    const day = [
      ex("Hanging Leg Raise", { category: "core" }),
      ex("Barbell Hip Thrust", { isPriority: true }),
      ex("Pallof Press", { category: "core" }),
      ex("Leg Extension"),
      ex("Plank", { category: "core" }),
      ex("Barbell Back Squat"),
    ];
    expect(names(orderExercises(day))).toEqual([
      "Barbell Hip Thrust",
      "Barbell Back Squat",
      "Leg Extension",
      "Hanging Leg Raise",
      "Pallof Press",
      "Plank",
    ]);
  });

  it("puts the core circuit after cardio but before mobility", () => {
    const day = [
      ex("Hip Flexor Stretch", { category: "mobility" }),
      ex("Plank", { category: "core" }),
      ex("Treadmill Intervals", { category: "cardio" }),
      ex("Barbell Back Squat"),
    ];
    expect(names(orderExercises(day))).toEqual([
      "Barbell Back Squat",
      "Treadmill Intervals",
      "Plank",
      "Hip Flexor Stretch",
    ]);
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

describe("ensureCoreCircuit", () => {
  it("appends a circuit when the model returned no core work at all", () => {
    const day = { dayOfWeek: 0, exercises: [ex("Barbell Back Squat"), ex("Leg Press")] };
    const out = ensureCoreCircuit(day, 0);
    const core = out.exercises.filter((e) => e.category === "core");
    expect(core).toHaveLength(4);
    expect(out.exercises).toHaveLength(6);
  });

  it("leaves a day alone when the model already produced core work", () => {
    const day = {
      dayOfWeek: 0,
      exercises: [ex("Barbell Back Squat"), ex("Hanging Leg Raise", { category: "core" })],
    };
    expect(ensureCoreCircuit(day, 0)).toEqual(day);
  });

  it("rotates circuits so every day is not identical", () => {
    const blank = () => ({ dayOfWeek: 0, exercises: [ex("Barbell Back Squat")] });
    const a = names(ensureCoreCircuit(blank(), 0).exercises);
    const b = names(ensureCoreCircuit(blank(), 1).exercises);
    expect(a).not.toEqual(b);
  });

  it("builds a circuit that is a brace, a flexion and a rotation", () => {
    const out = ensureCoreCircuit({ dayOfWeek: 0, exercises: [ex("Squat")] }, 0);
    expect(names(out.exercises.filter((e) => e.category === "core"))).toEqual([
      "Forearm Plank",
      "Hanging Leg Raise",
      "Pallof Press",
      "Reverse Crunch",
    ]);
  });
});

describe("orderWeek", () => {
  it("orders every day in the week", () => {
    const week = {
      weekNumber: 1,
      progressionStrategy: "base",
      days: [
        { dayOfWeek: 0, exercises: [ex("Leg Extension"), ex("Barbell Back Squat"), ex("Plank", { category: "core" })] },
        { dayOfWeek: 2, exercises: [ex("Lateral Raise"), ex("Bench Press"), ex("Plank", { category: "core" })] },
      ],
    };
    const out = orderWeek(week);
    expect(names(out.days[0].exercises)).toEqual(["Barbell Back Squat", "Leg Extension", "Plank"]);
    expect(names(out.days[1].exercises)).toEqual(["Bench Press", "Lateral Raise", "Plank"]);
    // original untouched
    expect(names(week.days[0].exercises)[0]).toBe("Leg Extension");
  });

  it("drops an empty rest day the model slipped in", () => {
    const week = {
      weekNumber: 1,
      progressionStrategy: "base",
      days: [
        { dayOfWeek: 0, focus: "Legs", exercises: [ex("Barbell Back Squat")] },
        { dayOfWeek: 3, focus: "Active Rest & Recovery", exercises: [] },
        { dayOfWeek: 4, focus: "Push", exercises: [ex("Bench Press")] },
      ],
    };
    const out = orderWeek(week);
    expect(out.days).toHaveLength(2);
    expect(out.days.map((d) => d.focus)).toEqual(["Legs", "Push"]);
  });

  it("gives every day a circuit even when the model supplied none", () => {
    const week = {
      weekNumber: 1,
      progressionStrategy: "base",
      days: [
        { dayOfWeek: 0, exercises: [ex("Barbell Back Squat")] },
        { dayOfWeek: 2, exercises: [ex("Bench Press")] },
      ],
    };
    const out = orderWeek(week);
    out.days.forEach((d) => {
      expect(d.exercises.filter((e) => e.category === "core")).toHaveLength(4);
    });
  });
});
