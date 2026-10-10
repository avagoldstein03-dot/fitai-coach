import { guardCalories, type CalorieGuard } from "@/lib/health-safety";

/**
 * The one calorie and macro calculation.
 *
 * There used to be two. /api/nutrition/targets computed a Harris-Benedict TDEE
 * with an activity multiplier and a goal adjustment; /api/nutrition/plan stored
 * a flat 30 kcal/kg. The Nutrition screen shows both at once — the computed one
 * at the top of the page and the stored one in the meal-plan card below it — so
 * a fat-loss user was being shown two different daily targets about 450 kcal
 * apart, on the same screen, with no way to tell which to believe.
 *
 * Both callers now use this.
 */

/** Harris-Benedict, which is what the app has always used. */
export function calculateTDEE(
  weight: number,
  height: number,
  age: number,
  sex: string,
  activityLevel: string
): number {
  const bmr =
    sex === "female"
      ? 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age
      : 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };

  return bmr * (activityMultipliers[activityLevel] || 1.375);
}

// Anabolic resistance (reduced muscle-protein-synthesis efficiency) increases as estrogen
// declines, so a modest protein increase alongside resistance training is standard
// sports-nutrition guidance during this life stage.
export const LIFE_STAGE_PROTEIN_BUMP_G_PER_KG = 0.2;

export function isMenopauseAdjacent(stage?: string | null): boolean {
  return stage === "perimenopause" || stage === "menopause" || stage === "postmenopause";
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  /** True only when a health guard actually moved a number. */
  guardApplied: boolean;
}

export function calculateMacros(
  tdee: number,
  goal: string,
  weight: number,
  lifeStage?: string | null,
  /**
   * Reported health conditions cap how aggressive a target may be — the formula
   * below is otherwise purely mechanical, which meant a user who had told the
   * app she was pregnant still got tdee-500 if her goal said fat loss.
   */
  guard?: CalorieGuard | null
): MacroTargets {
  let calories: number;
  let proteinPerKg: number;

  switch (goal) {
    case "fat_loss":
      calories = tdee - 500;
      proteinPerKg = 2.2;
      break;
    case "muscle_gain":
      calories = tdee + 300;
      proteinPerKg = 2.0;
      break;
    case "recomposition":
      calories = tdee;
      proteinPerKg = 2.2;
      break;
    case "athletic_performance":
      calories = tdee + 200;
      proteinPerKg = 1.8;
      break;
    default:
      calories = tdee;
      proteinPerKg = 1.6;
  }

  if (isMenopauseAdjacent(lifeStage)) {
    proteinPerKg += LIFE_STAGE_PROTEIN_BUMP_G_PER_KG;
  }

  // Applied after the goal has had its say and before anything is derived from
  // the figure, so protein, fat and carbs are all computed from the guarded
  // number rather than the one the goal alone would have produced.
  const unguarded = calories;
  calories = guardCalories(calories, tdee, guard ?? null);

  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  // The 50g floor is a sanity bound, not a recommendation. Where a condition
  // makes cutting carbohydrate the specific risk, its own floor applies.
  const rawCarbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const carbs = Math.max(rawCarbs, guard?.minCarbGrams ?? 50);

  return {
    calories: Math.round(calories),
    protein,
    carbs,
    fat,
    water: Math.round(weight * 35), // ml
    // Only true when something actually moved. Someone on a maintenance goal
    // who reports PCOS has no deficit to cap, and telling them their deficit
    // was kept moderate would describe a change that never happened.
    guardApplied: !!guard && (calories !== unguarded || carbs !== rawCarbs),
  };
}

/** The fields the real calculation needs. Anything missing and it cannot run. */
export interface ProfileForTargets {
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  sex?: string | null;
  activityLevel?: string | null;
  lifeStage?: string | null;
}

export function hasCompleteProfileForTargets(p: ProfileForTargets): boolean {
  return !!(p.weight && p.height && p.age && p.sex && p.activityLevel);
}

/**
 * Targets for a profile that may be incomplete.
 *
 * The meal-plan endpoint cannot refuse to generate a plan just because a height
 * is missing — it has always fallen back to rough numbers — so this returns the
 * real calculation when it can and the old flat 30 kcal/kg when it cannot.
 * Either way both endpoints now go through the same function, so the two
 * figures on the Nutrition screen agree whenever the profile allows it.
 */
export function targetsForProfile(
  profile: ProfileForTargets,
  goal: string,
  guard?: CalorieGuard | null
): MacroTargets & { tdee: number; estimated: boolean } {
  const weight = profile.weight || 70;

  if (hasCompleteProfileForTargets(profile)) {
    const tdee = calculateTDEE(
      profile.weight!,
      profile.height!,
      profile.age!,
      profile.sex!,
      profile.activityLevel!
    );
    return {
      ...calculateMacros(tdee, goal, profile.weight!, profile.lifeStage, guard),
      tdee: Math.round(tdee),
      estimated: false,
    };
  }

  // Fallback: no height/age/sex to work from, so treat 30 kcal/kg as the TDEE
  // and run it through the same goal and guard logic rather than skipping them.
  const roughTdee = Math.round(weight * 30);
  return {
    ...calculateMacros(roughTdee, goal, weight, profile.lifeStage, guard),
    tdee: roughTdee,
    estimated: true,
  };
}
