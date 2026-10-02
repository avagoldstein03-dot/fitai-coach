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
  // The ab circuit runs after the main session, so core work is kept together at
  // the end rather than interleaved with the lifts it would otherwise fatigue.
  CORE: 5,
  MOBILITY: 6,
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
  if (category === "core") return TIER.CORE;
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

/**
 * Ab circuits to fall back on when the model does not produce one.
 *
 * Each is a brace, a flexion movement and a rotation or anti-rotation, so a
 * circuit trains the midsection through its actual functions rather than three
 * variations of a crunch. They rotate by day so the same three do not appear in
 * every session, and they need no equipment beyond what any gym has.
 */
const CORE_CIRCUITS: ReadonlyArray<ReadonlyArray<Omit<WorkoutPlanExercise, "category">>> = [
  [
    { exerciseName: "Forearm Plank", sets: 3, reps: "30-45 sec", restSeconds: 30, notes: "Squeeze glutes and brace — no sagging through the hips.", movementType: "isolation" },
    { exerciseName: "Hanging Leg Raise", sets: 3, reps: "10-12", restSeconds: 45, notes: "Control the way down; no swinging.", movementType: "isolation" },
    { exerciseName: "Pallof Press", sets: 3, reps: "10-12 each side", restSeconds: 30, notes: "Resist the rotation rather than creating it.", movementType: "isolation" },
  ],
  [
    { exerciseName: "Dead Bug", sets: 3, reps: "10-12 each side", restSeconds: 30, notes: "Keep the lower back flat to the floor throughout.", movementType: "isolation" },
    { exerciseName: "Cable Crunch", sets: 3, reps: "12-15", restSeconds: 45, notes: "Round through the spine, not the hips.", movementType: "isolation" },
    { exerciseName: "Russian Twist", sets: 3, reps: "15 each side", restSeconds: 30, notes: "Rotate from the ribs, not the arms.", movementType: "isolation" },
  ],
  [
    { exerciseName: "Side Plank", sets: 3, reps: "30 sec each side", restSeconds: 30, notes: "Stack the hips and keep a straight line from head to heels.", movementType: "isolation" },
    { exerciseName: "Bicycle Crunch", sets: 3, reps: "15 each side", restSeconds: 30, notes: "Slow and deliberate beats fast and sloppy.", movementType: "isolation" },
    { exerciseName: "Ab Wheel Rollout", sets: 3, reps: "8-10", restSeconds: 45, notes: "Only roll out as far as you can keep the back flat.", movementType: "isolation" },
  ],
];

/**
 * Guarantees every day finishes with an ab circuit.
 *
 * The prompt asks for 2-3 core exercises per day, and the model regularly
 * returns none at all — the reported complaint was sessions of three real lifts
 * plus a single plank. Appending a circuit here makes it a property of the
 * output rather than something the model has to remember.
 */
export function ensureCoreCircuit(day: WorkoutPlanDay, dayIndex: number): WorkoutPlanDay {
  const hasCore = day.exercises.some((ex) => (ex.category ?? "").toLowerCase() === "core");
  if (hasCore) return day;

  const circuit = CORE_CIRCUITS[dayIndex % CORE_CIRCUITS.length].map((ex) => ({
    ...ex,
    category: "core",
  }));
  return { ...day, exercises: [...day.exercises, ...circuit] };
}

/**
 * Applies ordering and the core-circuit guarantee to every day, and drops days
 * with no training in them — the model sometimes emits an extra "Active Rest &
 * Recovery" entry with an empty exercise list, which renders as a blank day.
 * Does not mutate the input.
 */
export function orderWeek<T extends { days: WorkoutPlanDay[] }>(week: T): T {
  return {
    ...week,
    days: week.days
      .filter((day) => day.exercises.length > 0)
      .map((day, i) => {
        const withCore = ensureCoreCircuit(day, i);
        return { ...withCore, exercises: orderExercises(withCore.exercises) };
      }),
  };
}
