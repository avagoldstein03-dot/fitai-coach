/**
 * The profile answers' options, shared between onboarding and the editors.
 *
 * Mirrors backend/lib/profile-options.ts, which rejects anything not on these
 * lists. Labels reuse the onboarding translation keys rather than duplicating
 * the strings — the editor is asking the same question as the step that first
 * collected the answer, so it should ask it in the same words.
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

export const sexKey = (id: string) => `onboarding.step1.${id}`;
export const lifeStageKey = (id: string) => `onboarding.step1.${id}`;
export const activityKey = (id: string) => `onboarding.step3.${id}`;
export const activityDescKey = (id: string) => `onboarding.step3.${id}_desc`;
export const experienceKey = (id: string) => `onboarding.step4.${id}`;
export const experienceDescKey = (id: string) => `onboarding.step4.${id}_desc`;
export const goalKey = (id: string) => `onboarding.step2.${id}`;

/**
 * Life stage is only asked when sex is not male, matching onboarding step 1.
 * Kept as a function so the rule lives in one place rather than being
 * re-derived at each call site.
 */
export const showsLifeStage = (sex: string | null | undefined) => !!sex && sex !== "male";
