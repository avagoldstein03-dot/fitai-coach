import type { WorkoutPlanDay, WorkoutPlanWeek, WorkoutPlanExercise } from "@/services/ai-provider";
import { musclesFor, musclesForFocus, normalizeMuscles, type MuscleGroup } from "@/lib/exercise-muscles";

/**
 * Checks a generated week against the rules the prompt asks for.
 *
 * Every rule here exists because the model broke it in a real generation: a
 * barbell back squat on a back day, days of three lifts plus one plank, a week
 * with six days when five were asked for, one of them an empty "Active Rest &
 * Recovery" entry. Asking produces these most of the time; checking is how they
 * stop reaching users.
 *
 * Problems are phrased so they can be fed straight back to the model on a retry.
 */

export interface ValidationProblem {
  dayOfWeek?: number;
  message: string;
}

export const MAIN_EXERCISES_PER_DAY = 5;
export const MIN_CORE_EXERCISES = 3;
export const MAX_CORE_EXERCISES = 4;

const isCore = (ex: WorkoutPlanExercise) => (ex.category ?? "").toLowerCase() === "core";
const isMobility = (ex: WorkoutPlanExercise) => (ex.category ?? "").toLowerCase() === "mobility";
/** Main work is everything that is not the ab circuit or warm-up/cooldown. */
export const isMainWork = (ex: WorkoutPlanExercise) => !isCore(ex) && !isMobility(ex);

/**
 * Muscle groups an exercise trains.
 *
 * The generator declares these, which is what makes validation work for
 * exercises no keyword table happens to list. The keyword map is kept as a
 * cross-check rather than the source of truth: where it recognises the name it
 * wins, so a squat declared as training "back" is still caught. Where it does
 * not, the declared list is used.
 */
export function effectiveMuscles(ex: WorkoutPlanExercise): MuscleGroup[] {
  const known = musclesFor(ex.exerciseName);
  if (known.length) return known;
  return normalizeMuscles(ex.muscles);
}

/** Muscle groups a day covers — the declared list, or the prose label parsed. */
export function effectiveFocusMuscles(day: Pick<WorkoutPlanDay, "focus" | "focusMuscles">): MuscleGroup[] {
  const declared = normalizeMuscles(day.focusMuscles);
  if (declared.length) return declared;
  return musclesForFocus(day.focus);
}

/**
 * Whether an exercise trains anything the day covers.
 *
 * Still permissive in one case only: when neither the generator nor the keyword
 * map can say what an exercise trains, it passes rather than being rejected on
 * no evidence.
 */
export function exerciseFitsFocus(
  ex: WorkoutPlanExercise,
  day: Pick<WorkoutPlanDay, "focus" | "focusMuscles"> | string | undefined | null
): boolean {
  const dayRef = typeof day === "string" || day == null ? { focus: day ?? undefined } : day;
  const focusMuscles = effectiveFocusMuscles(dayRef);
  if (!focusMuscles.length) return true; // nothing to check against
  const exerciseMuscles = effectiveMuscles(ex);
  if (!exerciseMuscles.length) return true; // no evidence either way
  return exerciseMuscles.some((m) => focusMuscles.includes(m));
}

/**
 * Whether the generator's declared muscles contradict what the exercise
 * actually trains. Catches a mislabel used to slip past the focus check.
 */
export function declaredMusclesAreWrong(ex: WorkoutPlanExercise): boolean {
  const known = musclesFor(ex.exerciseName);
  const declared = normalizeMuscles(ex.muscles);
  if (!known.length || !declared.length) return false;
  return !declared.some((m) => known.includes(m));
}

export function validateDay(day: WorkoutPlanDay): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const at = (message: string) => problems.push({ dayOfWeek: day.dayOfWeek, message });

  if (!day.focus?.trim()) at(`Day ${day.dayOfWeek} has no "focus".`);

  const main = day.exercises.filter(isMainWork);
  const core = day.exercises.filter(isCore);

  if (main.length !== MAIN_EXERCISES_PER_DAY) {
    at(
      `Day ${day.dayOfWeek} ("${day.focus ?? "no focus"}") has ${main.length} main exercises; it needs exactly ${MAIN_EXERCISES_PER_DAY}, not counting the ab circuit.`
    );
  }
  if (core.length < MIN_CORE_EXERCISES || core.length > MAX_CORE_EXERCISES) {
    at(
      `Day ${day.dayOfWeek} ("${day.focus ?? "no focus"}") has ${core.length} exercises tagged "core"; it needs ${MIN_CORE_EXERCISES}-${MAX_CORE_EXERCISES} as an ab circuit.`
    );
  }

  for (const ex of main) {
    if (declaredMusclesAreWrong(ex)) {
      at(
        `"${ex.exerciseName}" is labelled as training ${normalizeMuscles(ex.muscles).join(", ")}, but it trains ${musclesFor(ex.exerciseName).join(", ")}. Label exercises accurately.`
      );
      continue; // the focus check below would be meaningless on a bad label
    }
    if (!exerciseFitsFocus(ex, day)) {
      at(
        `"${ex.exerciseName}" does not train ${day.focus} — it works ${effectiveMuscles(ex).join(", ")}. Replace it with an exercise for that day's focus, or move it to the day it belongs on.`
      );
    }
  }

  return problems;
}

export function validateWeek(week: WorkoutPlanWeek, expectedDays: number): ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  if (week.days.length !== expectedDays) {
    problems.push({
      message: `The week has ${week.days.length} training days; it must have exactly ${expectedDays}. Do not include rest or recovery days.`,
    });
  }
  const empty = week.days.filter((d) => d.exercises.length === 0);
  if (empty.length) {
    problems.push({ message: `${empty.length} day(s) have no exercises at all. Every day entry must be a real session.` });
  }
  const seen = new Set<number>();
  for (const d of week.days) {
    if (seen.has(d.dayOfWeek)) {
      problems.push({ dayOfWeek: d.dayOfWeek, message: `Two sessions are both on dayOfWeek ${d.dayOfWeek}.` });
    }
    seen.add(d.dayOfWeek);
  }

  week.days.forEach((d) => problems.push(...validateDay(d)));
  return problems;
}

/** Renders problems as a correction the model can act on directly. */
export function describeProblems(problems: ValidationProblem[]): string {
  return [
    "Your previous attempt had these specific problems. Produce the whole week again, fixed:",
    ...problems.map((p) => `- ${p.message}`),
  ].join("\n");
}
