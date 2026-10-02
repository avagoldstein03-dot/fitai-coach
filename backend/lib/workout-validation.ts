import type { WorkoutPlanDay, WorkoutPlanWeek, WorkoutPlanExercise } from "@/services/ai-provider";
import { musclesFor, musclesForFocus } from "@/lib/exercise-muscles";

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
export const MIN_CORE_EXERCISES = 2;
export const MAX_CORE_EXERCISES = 3;

const isCore = (ex: WorkoutPlanExercise) => (ex.category ?? "").toLowerCase() === "core";
const isMobility = (ex: WorkoutPlanExercise) => (ex.category ?? "").toLowerCase() === "mobility";
/** Main work is everything that is not the ab circuit or warm-up/cooldown. */
export const isMainWork = (ex: WorkoutPlanExercise) => !isCore(ex) && !isMobility(ex);

/**
 * Whether an exercise trains anything the day's focus covers.
 *
 * Unrecognised names pass: the mapping is keyword-based and will not know every
 * exercise, and rejecting an unknown name would throw away good training over a
 * gap in a lookup table.
 */
export function exerciseFitsFocus(ex: WorkoutPlanExercise, focus: string | undefined | null): boolean {
  const focusMuscles = musclesForFocus(focus);
  if (!focusMuscles.length) return true; // no usable focus to check against
  const exerciseMuscles = musclesFor(ex.exerciseName);
  if (!exerciseMuscles.length) return true; // unrecognised exercise
  return exerciseMuscles.some((m) => focusMuscles.includes(m));
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
    if (!exerciseFitsFocus(ex, day.focus)) {
      at(
        `"${ex.exerciseName}" does not train ${day.focus} — it works ${musclesFor(ex.exerciseName).join(", ")}. Replace it with an exercise for that day's focus, or move it to the day it belongs on.`
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
