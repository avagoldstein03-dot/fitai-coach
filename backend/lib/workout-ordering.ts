import type { WorkoutPlanDay, WorkoutPlanExercise } from "@/services/ai-provider";

/**
 * Puts a day's exercises into a sensible training order.
 *
 * The model was never told how to order a session, so it emitted whatever order
 * it felt like — a client whose stated goal was glutes got hip thrusts third,
 * after two exercises that had already fatigued the same muscles. Ordering is a
 * rule, not a judgement call, so it is applied here deterministically instead of
 * being asked for in the prompt and hoped for.
 *
 * The order is: the heaviest work that serves the client's stated goal, then the
 * rest of the compound work, then isolation (goal-serving first), then cardio,
 * then mobility as a cooldown. Within a tier the model's own order is kept —
 * Array.prototype.sort is stable — so its exercise-selection reasoning survives.
 */

const TIER = {
  PRIORITY_COMPOUND: 0,
  COMPOUND: 1,
  PRIORITY_ISOLATION: 2,
  ISOLATION: 3,
  CARDIO: 4,
  MOBILITY: 5,
} as const;

// Checked before the compound list, so "leg extension" is not caught by "press"
// style matches and "lying leg curl" does not read as a compound hinge.
const ISOLATION_PATTERNS = [
  /\bcurl\b/i,
  /\bextension\b/i,
  /\bfly(e|es)?\b/i,
  /\braise\b/i,
  /\bpushdown\b/i,
  /\bkickback\b/i,
  /\bpullover\b/i,
  /\bshrug\b/i,
  /\bcrunch\b/i,
  /\bsit[- ]?up\b/i,
  /\bab(duction|ductor)\b/i,
  /\badd(uction|uctor)\b/i,
  /\bface pull\b/i,
  /\brear delt\b/i,
  /\bcalf\b/i,
];

const COMPOUND_PATTERNS = [
  /\bsquat\b/i,
  /\bdeadlift\b/i,
  /\bpress\b/i,
  /\brow\b/i,
  /\bpull[- ]?up\b/i,
  /\bchin[- ]?up\b/i,
  /\bpulldown\b/i,
  /\bdip\b/i,
  /\blunge\b/i,
  /\bhip thrust\b/i,
  /\bglute bridge\b/i,
  /\bclean\b/i,
  /\bsnatch\b/i,
  /\bthruster\b/i,
  /\bstep[- ]?up\b/i,
  /\bgood morning\b/i,
  /\bpush[- ]?up\b/i,
  /\bsled\b/i,
  /\bcarry\b/i,
  /\bhyperextension\b/i,
];

/**
 * Falls back to the exercise name when the model omits movementType, so ordering
 * still holds for a response that ignored the labelling instruction.
 */
export function inferMovementType(name: string): "compound" | "isolation" | "unknown" {
  if (ISOLATION_PATTERNS.some((re) => re.test(name))) return "isolation";
  if (COMPOUND_PATTERNS.some((re) => re.test(name))) return "compound";
  return "unknown";
}

function tierFor(ex: WorkoutPlanExercise): number {
  const category = (ex.category ?? "strength").toLowerCase();
  if (category === "mobility") return TIER.MOBILITY;
  if (category === "cardio") return TIER.CARDIO;

  const movement = ex.movementType ?? inferMovementType(ex.exerciseName);
  // An unrecognised name sits with isolation rather than ahead of known compounds:
  // demoting a compound costs less than pushing real isolation work to the front.
  const isCompound = movement === "compound";

  if (ex.isPriority) return isCompound ? TIER.PRIORITY_COMPOUND : TIER.PRIORITY_ISOLATION;
  return isCompound ? TIER.COMPOUND : TIER.ISOLATION;
}

/** Returns the day's exercises in training order. Does not mutate the input. */
export function orderExercises(exercises: WorkoutPlanExercise[]): WorkoutPlanExercise[] {
  return [...exercises].sort((a, b) => tierFor(a) - tierFor(b));
}

/** Applies orderExercises to every day in a week. Does not mutate the input. */
export function orderWeek<T extends { days: WorkoutPlanDay[] }>(week: T): T {
  return {
    ...week,
    days: week.days.map((day) => ({ ...day, exercises: orderExercises(day.exercises) })),
  };
}
