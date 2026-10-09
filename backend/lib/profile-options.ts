/**
 * The fixed vocabularies for profile answers collected at onboarding.
 *
 * Extracted because these values are now accepted in two places — the
 * onboarding step that first collects them and the profile PATCH that lets
 * someone change their mind afterwards — and two copies of an enum is how one
 * of them ends up accepting a value the rest of the app cannot read.
 *
 * Every one of these changes real output, which is why they have to be
 * editable at all:
 *   sex                — branches the BMR formula
 *   activityLevel      — the TDEE multiplier, 1.2 to 1.725
 *   lifeStage          — the menopause protein bump
 *   fitnessExperience  — the beginner/advanced coaching directive
 */

export const SEXES = ["male", "female", "other"] as const;

export const LIFE_STAGES = [
  "not_applicable",
  "perimenopause",
  "menopause",
  "postmenopause",
  "prefer_not_to_say",
] as const;

export const ACTIVITY_LEVELS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
] as const;

export const FITNESS_EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const PRIMARY_GOALS = [
  "fat_loss",
  "muscle_gain",
  "recomposition",
  "athletic_performance",
  "general_health",
] as const;

export type Sex = (typeof SEXES)[number];
export type LifeStage = (typeof LIFE_STAGES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type FitnessExperience = (typeof FITNESS_EXPERIENCE_LEVELS)[number];
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

/**
 * Returns the value only if it is on the list, else undefined.
 *
 * Used by the profile PATCH so an unrecognised value is ignored rather than
 * stored — a bad `activityLevel` would otherwise fall through to the TDEE
 * multiplier's `|| 1.375` default and silently give someone the wrong calorie
 * target for as long as it sat there.
 */
export function onlyKnown<T extends readonly string[]>(
  allowed: T,
  value: unknown
): T[number] | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}
