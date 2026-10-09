import type { ReadinessResult } from "@/lib/trends";

/**
 * Adjusts today's session to how recovered the user actually is.
 *
 * The readiness score already existed and was shown on the dashboard, but
 * nothing acted on it — the app would tell someone they were at 44 and then
 * hand them the same heavy session it planned three weeks ago. This is the
 * thing the app can do that a nutrition app with no programming and a recovery
 * ring with no programming both structurally cannot.
 *
 * Three rules keep it trustworthy, because an adaptation nobody believes is
 * worse than none:
 *
 *   1. Volume only. Exercises are never swapped or removed. Someone who opened
 *      the app expecting squats should still find squats.
 *   2. It only ever pulls back, never adds. Telling a tired person to do more
 *      is the failure mode that loses trust permanently; a "primed" day gets a
 *      note encouraging a heavier top set, not extra sets imposed on them.
 *   3. It always says why, naming the real signal. "I took a set off" is
 *      irritating. "Your sleep was 22% below your average and your resting
 *      heart rate is up" is a reason.
 */

export interface ExerciseLike {
  exerciseName: string;
  sets: number;
  reps: string;
  category?: string | null;
}

export interface Adjustment {
  exerciseName: string;
  fromSets: number;
  toSets: number;
}

export interface SessionAdaptation {
  applied: boolean;
  score: number;
  label: ReadinessResult["label"];
  /** One sentence, written to the user, naming the signal behind the change. */
  note: string;
  adjustments: Adjustment[];
}

/** Below this many sets a session stops being worth doing, so nothing goes under it. */
const MIN_SETS = 2;

const isCore = (e: ExerciseLike) => (e.category ?? "").toLowerCase() === "core";
const isMobility = (e: ExerciseLike) => (e.category ?? "").toLowerCase() === "mobility";
/** The ab circuit and any warm-up work are low-load, so they are left alone. */
const isMainWork = (e: ExerciseLike) => !isCore(e) && !isMobility(e);

/** How many sets to remove from each main exercise at this readiness level. */
function setsToDrop(label: ReadinessResult["label"]): number {
  if (label === "prioritize_recovery") return 2;
  if (label === "take_it_easy") return 1;
  return 0; // primed and ready train as planned
}

/**
 * The strongest signal behind the score, phrased as a reason.
 *
 * Picks the factor that actually pushed the score down rather than listing all
 * three, because one specific reason reads as observation and three reads as a
 * readout.
 */
function reasonFrom(readiness: ReadinessResult): string {
  const negatives = readiness.factors.filter((f) => f.impact === "negative");
  if (!negatives.length) return "";
  // The detail strings already read as sentences; lowercase the first word so
  // they join cleanly onto the lead-in.
  const detail = negatives[0].detail;
  return detail.charAt(0).toLowerCase() + detail.slice(1);
}

/**
 * Returns the session adjusted for readiness, plus what changed and why.
 *
 * `applied: false` means today is trained exactly as planned — either because
 * recovery looks fine, or because there is not enough data to say. The note is
 * still populated for the "primed" case, where there is something worth saying
 * without changing anything.
 */
export function adaptSessionToReadiness<T extends ExerciseLike>(
  exercises: T[],
  readiness: ReadinessResult | null
): { exercises: T[]; adaptation: SessionAdaptation | null } {
  if (!readiness) return { exercises, adaptation: null };

  const drop = setsToDrop(readiness.label);

  if (drop === 0) {
    const note =
      readiness.label === "primed"
        ? "Recovery looks good today — this is a day to push your top set if it feels right."
        : "Recovery looks normal. Train as planned.";
    return {
      exercises,
      adaptation: { applied: false, score: readiness.score, label: readiness.label, note, adjustments: [] },
    };
  }

  const adjustments: Adjustment[] = [];
  const adapted = exercises.map((e) => {
    if (!isMainWork(e)) return e;
    const toSets = Math.max(MIN_SETS, e.sets - drop);
    if (toSets === e.sets) return e;
    adjustments.push({ exerciseName: e.exerciseName, fromSets: e.sets, toSets });
    return { ...e, sets: toSets };
  });

  if (!adjustments.length) {
    // Already at or below the floor — nothing to pull back without gutting it.
    return {
      exercises,
      adaptation: {
        applied: false,
        score: readiness.score,
        label: readiness.label,
        note: "Recovery is low today. This session is already light, so it is unchanged — take the loads easier than usual.",
        adjustments: [],
      },
    };
  }

  const reason = reasonFrom(readiness);
  const setWord = drop === 1 ? "a set" : `${drop} sets`;
  const note = reason
    ? `${reason.replace(/\.$/, "")} — so ${setWord} came off each of your main lifts today. Keep the weight; just do less of it.`
    : `Recovery is low today, so ${setWord} came off each of your main lifts. Keep the weight; just do less of it.`;

  return {
    exercises: adapted,
    adaptation: { applied: true, score: readiness.score, label: readiness.label, note, adjustments },
  };
}
