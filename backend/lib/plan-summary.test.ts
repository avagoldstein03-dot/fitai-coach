import { buildNutritionPlanSummary, buildWorkoutPlanSummary } from "./plan-summary";

// 2026-10-06 is a Tuesday.
const TUESDAY = new Date("2026-10-06T12:00:00Z");

const plan = {
  dailyCaloricTarget: 2350,
  proteinTarget: 148,
  carbsTarget: 235,
  fatsTarget: 65,
  mealPlan: {
    days: [
      { day: "Monday", meals: [{ name: "Breakfast", foods: ["Oats"], calories: 400, protein: 20, carbs: 60, fat: 8 }] },
      { day: "Tuesday", meals: [
        { name: "Breakfast", foods: ["Greek yogurt", "Berries"], calories: 325, protein: 25, carbs: 42, fat: 6 },
        { name: "Lunch", foods: ["Chicken", "Rice"], calories: 610, protein: 58, carbs: 56, fat: 16 },
      ]},
    ],
  },
};

describe("buildNutritionPlanSummary", () => {
  it("says nothing when there is no plan", () => {
    expect(buildNutritionPlanSummary(null)).toBe("");
  });

  it("always states the daily targets", () => {
    const out = buildNutritionPlanSummary({ ...plan, mealPlan: undefined }, TUESDAY);
    expect(out).toContain("2350 kcal");
    expect(out).toContain("148g protein");
  });

  it("includes today's meals with their macros", () => {
    const out = buildNutritionPlanSummary(plan, TUESDAY);
    expect(out).toContain("Tuesday");
    expect(out).toContain("Chicken, Rice");
    expect(out).toContain("610 kcal, 58p 56c 16f");
  });

  it("leaves out the other days", () => {
    const out = buildNutritionPlanSummary(plan, TUESDAY);
    expect(out).not.toContain("Oats");
  });

  it("says so when today is not in the plan", () => {
    const sunday = new Date("2026-10-11T12:00:00Z");
    const out = buildNutritionPlanSummary(plan, sunday);
    expect(out).toContain("nothing is planned for today");
  });

  it("tolerates a bare array instead of { days: [...] }", () => {
    const bare = { ...plan, mealPlan: (plan.mealPlan as any).days };
    expect(buildNutritionPlanSummary(bare, TUESDAY)).toContain("Chicken, Rice");
  });

  it("does not fall over on a malformed plan", () => {
    expect(() => buildNutritionPlanSummary({ ...plan, mealPlan: "nonsense" }, TUESDAY)).not.toThrow();
    expect(() => buildNutritionPlanSummary({ ...plan, mealPlan: { days: null } as any }, TUESDAY)).not.toThrow();
  });
});

const program = {
  name: "4-Week recomposition Program",
  weeks: [{
    days: [
      { dayOfWeek: 1, focus: "Glutes & Hamstrings", exercises: [
        { exerciseName: "Barbell Hip Thrust", sets: 4, reps: "8-10" },
        { exerciseName: "Plank", sets: 3, reps: "30 sec", category: "core" },
      ]},
      { dayOfWeek: 3, focus: "Upper Body", exercises: [
        { exerciseName: "Bench Press", sets: 4, reps: "6-8" },
      ]},
    ],
  }],
};

describe("buildWorkoutPlanSummary", () => {
  it("says nothing without a program", () => {
    expect(buildWorkoutPlanSummary(null)).toBe("");
  });

  it("gives today's session when today is a training day", () => {
    const out = buildWorkoutPlanSummary(program, TUESDAY); // Tuesday = dayOfWeek 1
    expect(out).toContain("Glutes & Hamstrings");
    expect(out).toContain("Barbell Hip Thrust — 4 x 8-10");
  });

  it("separates the ab circuit from the main work", () => {
    const out = buildWorkoutPlanSummary(program, TUESDAY);
    expect(out).toContain("Ab circuit: Plank 3 x 30 sec");
  });

  it("names the training days on a rest day", () => {
    const monday = new Date("2026-10-05T12:00:00Z"); // dayOfWeek 0, not in the program
    const out = buildWorkoutPlanSummary(program, monday);
    expect(out).toContain("rest day");
    expect(out).toContain("Tuesday");
  });
});
