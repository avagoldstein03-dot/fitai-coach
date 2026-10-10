import { normalizeConditions } from "@/lib/medical-conditions";

/**
 * Progress toward a goal weight.
 *
 * targetWeight and timeline had been columns on Goal since the beginning that
 * no screen ever wrote and nothing ever read. This makes them mean something:
 * a target, a start point snapshotted when it was set, and an honest statement
 * of the rate it implies.
 *
 * The honesty is the point. A target is only useful if the app will say when it
 * is unrealistic, so the required rate is computed and flagged rather than
 * quietly displayed as a countdown. And for two reported conditions the whole
 * feature is withheld — see shouldShowWeightTarget below.
 */

/** Above this share of bodyweight per week, a rate is not sustainable. */
const AGGRESSIVE_RATE_FRACTION = 0.01; // 1% of bodyweight
/** Below this, a target is close enough to call met rather than nagging about. */
const MET_TOLERANCE_KG = 0.5;

export type GoalDirection = "lose" | "gain" | "maintain";
export type GoalPace = "ahead" | "on_track" | "behind" | "met" | "unknown";

export interface GoalProgressInput {
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  timelineWeeks?: number | null;
  targetSetAt?: Date | string | null;
  now?: Date;
}

export interface GoalProgress {
  direction: GoalDirection;
  /** How far there is still to go, in kg. Never negative. */
  remainingKg: number;
  /** The whole journey, start to target, in kg. */
  totalKg: number;
  /** 0-100, clamped. 100 once the target is met. */
  percentComplete: number;
  weeksElapsed: number | null;
  weeksRemaining: number | null;
  /** kg per week still needed to land on time. Null without a timeline. */
  requiredRateKgPerWeek: number | null;
  pace: GoalPace;
  /**
   * True when the required rate is faster than is sustainable.
   *
   * Separate from the sentence below because the UI has to render this in the
   * user's own units and language, and a server-built string cannot. The
   * sentence is for the coach prompt, which reads kg quite happily.
   */
  rateIsAggressive: boolean;
  /** Prose for the coach prompt. Not for display — it is English and in kg. */
  rateWarning: string | null;
}

/**
 * Whether to show a weight target at all.
 *
 * Two reported conditions turn this feature off rather than adapting it. The
 * disordered-eating directive says not to emphasise weight, scale numbers or
 * appearance — a countdown to a goal weight with a pace rating is precisely
 * that, and no amount of gentle wording makes it not that. Pregnancy has its
 * own reason: the app already refuses to set a deficit, so a weight target
 * would contradict the calorie target it hands out.
 *
 * This is the same judgement as the calorie guards in lib/health-safety, which
 * is why it reads the same field. It is deliberately a block and not a cap:
 * there is no gentler version of a scale countdown.
 */
export function shouldShowWeightTarget(conditions: unknown): boolean {
  const reported = normalizeConditions(conditions);
  return !reported.some(
    (c) => c === "disordered_eating_history" || c === "pregnant_or_postpartum"
  );
}

function weeksBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000);
}

/**
 * Computes progress, or null when there is not enough to say anything.
 *
 * Null rather than a zeroed object, so a caller cannot accidentally render
 * "0% complete" for someone who has set no target.
 */
export function computeGoalProgress(input: GoalProgressInput): GoalProgress | null {
  const { targetWeight, currentWeight } = input;
  if (targetWeight == null || currentWeight == null) return null;

  // Falling back to the current weight makes the first render read as 0%
  // progress rather than as an error, which is the truth on day one.
  const startWeight = input.startWeight ?? currentWeight;
  const now = input.now ?? new Date();

  const totalKg = Math.abs(targetWeight - startWeight);

  const direction: GoalDirection =
    totalKg < MET_TOLERANCE_KG ? "maintain" : targetWeight < startWeight ? "lose" : "gain";

  // Signed, because an absolute distance cannot tell being 2kg short of the
  // target from being 2kg past it — and someone who has passed it is finished,
  // not 80% of the way there.
  const met =
    direction === "lose"
      ? currentWeight <= targetWeight + MET_TOLERANCE_KG
      : direction === "gain"
        ? currentWeight >= targetWeight - MET_TOLERANCE_KG
        : Math.abs(targetWeight - currentWeight) <= MET_TOLERANCE_KG;

  const remainingKg = met ? 0 : Math.abs(targetWeight - currentWeight);

  // Ground covered in the intended direction. Negative for someone moving the
  // wrong way, which clamps to 0 rather than reading as negative progress.
  const achievedKg = direction === "gain" ? currentWeight - startWeight : startWeight - currentWeight;
  const percentComplete = met
    ? 100
    : totalKg === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((achievedKg / totalKg) * 100)));

  const setAt = input.targetSetAt ? new Date(input.targetSetAt) : null;
  const weeksElapsed = setAt ? Math.max(0, weeksBetween(setAt, now)) : null;
  const weeksRemaining =
    input.timelineWeeks != null && weeksElapsed != null
      ? Math.max(0, input.timelineWeeks - weeksElapsed)
      : null;

  // A rate is only meaningful while there is time left to cover the distance.
  const requiredRateKgPerWeek =
    !met && weeksRemaining != null && weeksRemaining > 0
      ? remainingKg / weeksRemaining
      : null;

  let pace: GoalPace = "unknown";
  if (met) {
    pace = "met";
  } else if (input.timelineWeeks != null && weeksElapsed != null && totalKg >= MET_TOLERANCE_KG) {
    // Where they should be by now if the change were spread evenly.
    const expectedFraction = Math.min(1, weeksElapsed / input.timelineWeeks);
    const actualFraction = achievedKg / totalKg;
    if (actualFraction >= expectedFraction + 0.1) pace = "ahead";
    else if (actualFraction <= expectedFraction - 0.1) pace = "behind";
    else pace = "on_track";
  }

  // Flagged against current bodyweight rather than a flat kg figure, because
  // 0.8kg a week is a different proposition at 55kg than at 110kg.
  let rateWarning: string | null = null;
  let rateIsAggressive = false;
  if (requiredRateKgPerWeek != null) {
    const sustainable = currentWeight * AGGRESSIVE_RATE_FRACTION;
    if (requiredRateKgPerWeek > sustainable) {
      rateIsAggressive = true;
      rateWarning =
        `Hitting this by then would mean about ${requiredRateKgPerWeek.toFixed(1)}kg a week, ` +
        `which is faster than is sustainable. Giving yourself more time is the easier fix than eating less.`;
    }
  }

  return {
    direction,
    remainingKg: Math.round(remainingKg * 10) / 10,
    totalKg: Math.round(totalKg * 10) / 10,
    percentComplete,
    weeksElapsed: weeksElapsed == null ? null : Math.round(weeksElapsed * 10) / 10,
    weeksRemaining: weeksRemaining == null ? null : Math.round(weeksRemaining * 10) / 10,
    requiredRateKgPerWeek:
      requiredRateKgPerWeek == null ? null : Math.round(requiredRateKgPerWeek * 100) / 100,
    pace,
    rateIsAggressive,
    rateWarning,
  };
}

/** One line for the coach, so chat can speak to the target the user set. */
export function describeGoalForCoach(progress: GoalProgress | null, targetWeight?: number | null): string {
  if (!progress || targetWeight == null) return "";
  if (progress.pace === "met") {
    return `They have reached their goal weight of ${targetWeight}kg. Shift the conversation toward maintaining it rather than pushing further.`;
  }
  const verb = progress.direction === "gain" ? "gain" : "lose";
  const timing =
    progress.weeksRemaining != null
      ? ` They have about ${Math.round(progress.weeksRemaining)} weeks left of the timeline they set.`
      : "";
  const caution = progress.rateWarning
    ? " The pace their own timeline implies is faster than is sustainable — say so plainly if the timeline comes up, and suggest extending it rather than cutting harder."
    : "";
  return `They set a goal weight of ${targetWeight}kg and have ${progress.remainingKg}kg left to ${verb} (${progress.percentComplete}% of the way there).${timing}${caution}`;
}
