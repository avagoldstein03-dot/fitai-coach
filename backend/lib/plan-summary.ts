/**
 * Turns the user's actual plans into something the coach can speak from.
 *
 * Without this the coach knew what someone had eaten and trained, but not what
 * they were *supposed* to — so asked "what should I have for lunch", it invented
 * a reasonable answer that ignored the meal plan the app had already built, and
 * asked "what's my workout today" it had nothing to say at all.
 *
 * Kept compact on purpose: this rides in every chat request, and a full seven-day
 * plan serialised raw would crowd out the conversation history it sits beside.
 */

interface PlanMeal {
  name?: string;
  foods?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}
interface PlanDay {
  day?: string;
  meals?: PlanMeal[];
}

export interface NutritionPlanLike {
  dailyCaloricTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  mealPlan?: unknown;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Today's name, Monday-first, matching how the meal plan labels its days. */
function todayName(now = new Date()): string {
  return DAY_NAMES[(now.getDay() + 6) % 7];
}

/**
 * Today's planned meals and the day's targets.
 *
 * Only today is included. The coach is being asked what to eat now, and a
 * seven-day dump would be mostly irrelevant tokens.
 */
export function buildNutritionPlanSummary(
  plan: NutritionPlanLike | null | undefined,
  now = new Date()
): string {
  if (!plan) return "";

  const lines = [
    `Daily targets: ${Math.round(plan.dailyCaloricTarget)} kcal, ${Math.round(plan.proteinTarget)}g protein, ${Math.round(plan.carbsTarget)}g carbs, ${Math.round(plan.fatsTarget)}g fat.`,
  ];

  const days = Array.isArray((plan.mealPlan as { days?: PlanDay[] })?.days)
    ? ((plan.mealPlan as { days: PlanDay[] }).days)
    : Array.isArray(plan.mealPlan)
      ? (plan.mealPlan as PlanDay[])
      : [];

  const today = todayName(now);
  const planned = days.find((d) => (d.day ?? "").toLowerCase() === today.toLowerCase());

  if (planned?.meals?.length) {
    lines.push(`Their meal plan for today (${today}):`);
    for (const m of planned.meals) {
      const macros = m.calories
        ? ` — ${Math.round(m.calories)} kcal, ${Math.round(m.protein ?? 0)}p ${Math.round(m.carbs ?? 0)}c ${Math.round(m.fat ?? 0)}f`
        : "";
      lines.push(`- ${m.name ?? "Meal"}: ${(m.foods ?? []).join(", ")}${macros}`);
    }
    lines.push(
      "When they ask what to eat, work from this plan first — suggest the planned meal, or something that fits the same macro gap, rather than inventing an unrelated meal. Give a log_food marker for whatever you suggest, using the macros above, so they can log it without retyping it."
    );
  } else if (days.length) {
    lines.push("They have a meal plan, but nothing is planned for today specifically.");
  }

  return lines.join("\n");
}

interface ProgramExercise {
  exerciseName: string;
  sets: number;
  reps: string;
  category?: string;
}
interface ProgramDay {
  dayOfWeek: number;
  focus?: string | null;
  exercises: ProgramExercise[];
}

/**
 * Today's session from the active program, if today is a training day.
 *
 * The coach could previously only talk about workouts in the abstract. With
 * this it can answer "what am I doing today" with the actual session, and offer
 * to log the exercises in it.
 */
export function buildWorkoutPlanSummary(
  program: { name: string; weeks: Array<{ days: ProgramDay[] }> } | null | undefined,
  now = new Date()
): string {
  if (!program?.weeks?.length) return "";

  const todayIdx = (now.getDay() + 6) % 7; // Monday = 0
  const day = program.weeks[0].days.find((d) => d.dayOfWeek === todayIdx);

  if (!day) {
    const trainingDays = program.weeks[0].days
      .map((d) => DAY_NAMES[d.dayOfWeek])
      .filter(Boolean)
      .join(", ");
    return `Their program is "${program.name}". Today is a rest day; they train on ${trainingDays}.`;
  }

  const main = day.exercises.filter((e) => (e.category ?? "").toLowerCase() !== "core");
  const core = day.exercises.filter((e) => (e.category ?? "").toLowerCase() === "core");

  const lines = [
    `Their program is "${program.name}". Today's session is ${day.focus ?? "training"}:`,
    ...main.map((e) => `- ${e.exerciseName} — ${e.sets} x ${e.reps}`),
  ];
  if (core.length) {
    lines.push(`Ab circuit: ${core.map((e) => `${e.exerciseName} ${e.sets} x ${e.reps}`).join(", ")}`);
  }
  lines.push(
    "When they ask about today's training, answer from this session rather than suggesting something generic."
  );
  return lines.join("\n");
}
