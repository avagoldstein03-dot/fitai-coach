/**
 * The health questions' options, in one place.
 *
 * These ids are a contract with the backend: lib/health-safety.ts and
 * lib/medical-conditions.ts reject anything not on their matching lists, and a
 * reported knee only becomes a reviewed exercise substitution because the id
 * arrives intact. Onboarding and Settings both read from here so the two screens
 * cannot drift — before this, Settings had no health editor at all and
 * onboarding kept its own copy of both lists.
 *
 * The labels live in the locale files under onboarding.step4.*, which both
 * screens share rather than duplicating the translations.
 */

/** Mirrors INJURY_AREAS in backend/lib/health-safety.ts. */
export const INJURY_AREAS = [
  "lower_back",
  "knee",
  "shoulder",
  "hip",
  "neck",
  "ankle",
  "wrist",
  "elbow",
] as const;

export type InjuryArea = (typeof INJURY_AREAS)[number];

/** Mirrors MEDICAL_CONDITIONS in backend/lib/medical-conditions.ts. */
export const MEDICAL_CONDITIONS = [
  "high_blood_pressure",
  "heart_condition",
  "diabetes_type_1",
  "diabetes_type_2",
  "asthma",
  "pcos",
  "thyroid",
  "joint_condition",
  "pregnant_or_postpartum",
  "disordered_eating_history",
  "prefer_not_to_say",
] as const;

export type MedicalCondition = (typeof MEDICAL_CONDITIONS)[number];

/**
 * The conditions offered as chips.
 *
 * "prefer_not_to_say" is excluded because the Yes/No question in front of these
 * now serves that purpose — answering "No" to "anything health-wise we should
 * know about?" says the same thing with one tap. The backend still accepts the
 * value, so nothing already stored is invalidated.
 */
export const SELECTABLE_CONDITIONS = MEDICAL_CONDITIONS.filter(
  (c) => c !== "prefer_not_to_say"
);

/** Translation keys, so both screens label these the same way. */
export const injuryAreaKey = (id: string) => `onboarding.step4.injury_${id}`;
export const conditionKey = (id: string) => `onboarding.step4.condition_${id}`;
