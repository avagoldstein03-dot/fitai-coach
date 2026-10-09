import {
  normalizeConditions,
  healthContextBlock,
  type MedicalCondition,
} from "@/lib/medical-conditions";

/**
 * The deterministic half of health safety.
 *
 * lib/medical-conditions turns a reported condition into an instruction for the
 * model. That is the asking half, and on its own it is not enough: a prompt that
 * says "do not recommend a calorie deficit" is followed most of the time, and
 * "most of the time" is the wrong standard for a pregnant user's calorie target
 * or for keeping a barbell deadlift away from a reported disc injury.
 *
 * So everything in this file is enforced in code, after the model has answered —
 * the same ask-then-enforce split the workout validator already uses for
 * exercise counts, applied to the parts of the app where being wrong matters
 * more than being annoying.
 *
 * None of it diagnoses or treats anything. It only ever makes the app's own
 * output more conservative.
 */

// ---------------------------------------------------------------------------
// Injury areas
// ---------------------------------------------------------------------------

/**
 * Common injury sites, collected as tappable options at onboarding.
 *
 * These are ids, not prose, which is the whole point: the free-text injury note
 * is still kept and still goes to the model, but a known key can drive a
 * reviewed substitution in code, and it survives being written in any language.
 *
 * Must stay in step with INJURY_AREAS in frontend/screens/onboarding/Step4Screen.
 */
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

const VALID_AREAS = new Set<string>(INJURY_AREAS);

/** Drops anything not on the list, so this field cannot inject prose into a prompt. */
export function normalizeInjuryAreas(input: unknown): InjuryArea[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<InjuryArea>();
  for (const raw of input) {
    if (typeof raw === "string" && VALID_AREAS.has(raw)) out.add(raw as InjuryArea);
  }
  return [...out];
}

/** English labels for prompts. The app's own UI translates these ids separately. */
const AREA_LABELS: Record<InjuryArea, string> = {
  lower_back: "lower back",
  knee: "knee",
  shoulder: "shoulder",
  hip: "hip",
  neck: "neck",
  ankle: "ankle",
  wrist: "wrist",
  elbow: "elbow",
};

export function describeInjuryAreas(areas: InjuryArea[]): string {
  return areas.map((a) => AREA_LABELS[a]).join(", ");
}

// ---------------------------------------------------------------------------
// Contraindicated movements
// ---------------------------------------------------------------------------

interface Contraindication {
  /** Matched against the exercise name, case-insensitively. */
  pattern: RegExp;
  areas: InjuryArea[];
  /** Why, in a half-sentence, for the retry message and the user-facing note. */
  because: string;
  /**
   * What to put there instead — a real exercise that trains something similar
   * with the risky element removed. Null means there is no like-for-like swap
   * and the exercise should simply come out.
   */
  saferAlternative: string | null;
}

/**
 * Movements worth keeping away from a reported injury site, with a substitute.
 *
 * Deliberately a short list of the clearest cases rather than an attempt at
 * completeness. Each entry is a movement where the loaded position itself is the
 * problem — heavy spinal flexion on a reported lower back, deep knee flexion
 * under load on a reported knee, overhead and behind-the-neck work on a reported
 * shoulder — not merely an exercise that happens to involve the joint. Being too
 * aggressive here would strip good training out of everyone's program, which is
 * its own kind of harm.
 *
 * Order matters: the first match wins, so specific patterns come before general
 * ones ("Romanian Deadlift" before "deadlift").
 */
const CONTRAINDICATIONS: Contraindication[] = [
  // --- lower back -----------------------------------------------------------
  {
    pattern: /romanian deadlift|stiff[- ]?legg?e?d? deadlift|\brdl\b/i,
    areas: ["lower_back"],
    because: "it loads the hamstrings through a long spinal lever",
    saferAlternative: "Seated Leg Curl",
  },
  {
    pattern: /good morning/i,
    areas: ["lower_back"],
    because: "it loads spinal extension directly",
    saferAlternative: "Hip Thrust",
  },
  {
    pattern: /jefferson curl/i,
    areas: ["lower_back"],
    because: "it is loaded spinal flexion",
    saferAlternative: null,
  },
  {
    pattern: /bent[- ]?over (barbell |dumbbell )?row|pendlay row|barbell row/i,
    areas: ["lower_back"],
    because: "it holds a hinged position under load for the whole set",
    saferAlternative: "Chest-Supported Row",
  },
  {
    pattern: /sumo deadlift/i,
    areas: ["lower_back", "hip"],
    because: "it combines a deep hip position with heavy axial load",
    saferAlternative: "Hip Thrust",
  },
  {
    pattern: /deadlift/i,
    areas: ["lower_back"],
    because: "it is the heaviest axial load in most programs",
    saferAlternative: "Hip Thrust",
  },
  {
    pattern: /back squat/i,
    areas: ["lower_back"],
    because: "the bar loads the spine directly",
    saferAlternative: "Leg Press",
  },

  // --- shoulder / neck ------------------------------------------------------
  {
    pattern: /behind[- ]the[- ]neck|behind[- ]neck/i,
    areas: ["shoulder", "neck"],
    because: "it forces end-range external rotation behind the head",
    saferAlternative: "Lat Pulldown",
  },
  {
    pattern: /upright row/i,
    areas: ["shoulder"],
    because: "it internally rotates the shoulder under load at the top",
    saferAlternative: "Dumbbell Lateral Raise",
  },
  {
    pattern: /kipping pull[- ]?up/i,
    areas: ["shoulder"],
    because: "it loads the shoulder ballistically at full stretch",
    saferAlternative: "Lat Pulldown",
  },
  {
    pattern: /neck (curl|extension|bridge)/i,
    areas: ["neck"],
    because: "it loads the neck directly",
    saferAlternative: null,
  },
  {
    pattern: /barbell shrug/i,
    areas: ["neck"],
    because: "a fixed bar locks the shoulders into one path under heavy load",
    saferAlternative: "Dumbbell Shrug",
  },
  {
    pattern: /handstand|headstand|planche/i,
    areas: ["neck", "wrist", "shoulder"],
    because: "it bears bodyweight through the wrists and neck",
    saferAlternative: "Landmine Press",
  },
  {
    // Overhead pressing of any kind, not just barbell. The first draft of this
    // table treated a dumbbell press as the shoulder-friendly substitute for a
    // barbell one, which is a position that contradicts itself: if pressing
    // overhead is what a sore shoulder objects to, swapping the implement does
    // not fix it. The landmine press keeps the pressing pattern at an angle the
    // shoulder tolerates far better.
    pattern: /(shoulder|overhead|military) press|push press|arnold press|\bjerk\b/i,
    areas: ["shoulder"],
    because: "pressing overhead is the position a sore shoulder tends to object to",
    saferAlternative: "Landmine Press",
  },

  // --- knee / hip / ankle (impact and deep flexion) -------------------------
  {
    pattern: /sissy squat/i,
    areas: ["knee"],
    because: "it puts the knee in deep flexion with the load far in front of it",
    saferAlternative: "Leg Extension",
  },
  {
    pattern: /pistol squat/i,
    areas: ["knee", "hip"],
    because: "it loads one knee through its deepest range",
    saferAlternative: "Leg Press",
  },
  {
    pattern: /jump|plyo|burpee|bounding|hop\b/i,
    areas: ["knee", "hip", "ankle"],
    because: "landing is a high-impact load",
    saferAlternative: "Leg Press",
  },
  {
    pattern: /sprint|\bskipping\b|jump rope|skater/i,
    areas: ["ankle", "knee"],
    because: "it is repeated impact on one joint",
    saferAlternative: "Stationary Bike",
  },

  // --- wrist / elbow --------------------------------------------------------
  {
    pattern: /front squat/i,
    areas: ["wrist"],
    because: "the rack position forces the wrist into end-range extension",
    saferAlternative: "Leg Press",
  },
  {
    pattern: /(power |hang )?clean|snatch/i,
    areas: ["wrist", "shoulder", "lower_back"],
    because: "it catches a moving bar on the wrists and shoulders",
    saferAlternative: "Landmine Press",
  },
  {
    pattern: /skull ?crusher|lying triceps extension|overhead (triceps |tricep )?extension/i,
    areas: ["elbow"],
    because: "it loads the elbow at its most stretched position",
    saferAlternative: "Cable Triceps Pushdown",
  },
  {
    pattern: /close[- ]grip bench/i,
    areas: ["elbow", "wrist"],
    because: "a narrow grip on a fixed bar concentrates load on the elbow",
    saferAlternative: "Dumbbell Bench Press",
  },
  {
    pattern: /\bdips?\b/i,
    areas: ["shoulder", "elbow"],
    because: "it loads the shoulder and elbow at the bottom of a deep range",
    saferAlternative: "Cable Triceps Pushdown",
  },
  {
    pattern: /(barbell|ez[- ]?bar|straight[- ]bar) curl/i,
    areas: ["wrist", "elbow"],
    because: "a fixed bar locks the forearm into one rotation",
    saferAlternative: "Dumbbell Hammer Curl",
  },
];

/**
 * What to tell the model to avoid, per area.
 *
 * Written as guidance rather than as the regex list above, because a prompt
 * given a list of patterns tends to dodge the exact names and keep the movement
 * ("Barbell Hinge" instead of "Deadlift"). Naming the loaded position gets
 * better selection than naming the exercises does.
 */
export const INJURY_PROMPT_HINTS: { area: InjuryArea; areaLabel: string; avoid: string }[] = [
  {
    area: "lower_back",
    areaLabel: "lower back",
    avoid: "barbell deadlifts, back squats, good mornings and bent-over rows; use supported and machine alternatives",
  },
  {
    area: "knee",
    areaLabel: "knee",
    avoid: "jumping and plyometric work, and deep single-leg squatting",
  },
  {
    area: "shoulder",
    areaLabel: "shoulder",
    avoid: "overhead pressing, behind-the-neck work, upright rows and dips",
  },
  {
    area: "hip",
    areaLabel: "hip",
    avoid: "deep-hip loading like sumo pulls, and jumping work",
  },
  {
    area: "neck",
    areaLabel: "neck",
    avoid: "behind-the-neck work, heavy barbell shrugs and anything inverted",
  },
  {
    area: "ankle",
    areaLabel: "ankle",
    avoid: "running, skipping, jumping and other repeated-impact conditioning; use cycling or rowing",
  },
  {
    area: "wrist",
    areaLabel: "wrist",
    avoid: "front squats, cleans and bodyweight work bearing load through the hands; use neutral-grip dumbbells",
  },
  {
    area: "elbow",
    areaLabel: "elbow",
    avoid: "skullcrushers, overhead extensions, dips and straight-bar curls",
  },
];

export interface InjuryConflict {
  area: InjuryArea;
  areaLabel: string;
  because: string;
  saferAlternative: string | null;
}

/**
 * Whether this exercise is one to keep away from the reported injury sites.
 *
 * Returns the first conflict found, or null. A name no pattern recognises
 * passes — this is a list of known-risky movements, not an allow-list, so an
 * unfamiliar exercise is never rejected on no evidence.
 */
export function injuryConflict(
  exerciseName: string,
  areas: InjuryArea[]
): InjuryConflict | null {
  if (!areas.length || !exerciseName) return null;
  for (const c of CONTRAINDICATIONS) {
    if (!c.pattern.test(exerciseName)) continue;
    const area = c.areas.find((a) => areas.includes(a));
    if (!area) continue;
    return {
      area,
      areaLabel: AREA_LABELS[area],
      because: c.because,
      saferAlternative: c.saferAlternative,
    };
  }
  return null;
}

/**
 * The substitute to use, having found a conflict — or null to drop the exercise.
 *
 * The alternative is itself checked against every reported area, because a swap
 * that trades one person's bad knee for their bad back is worse than no swap.
 */
export function saferSubstitute(
  conflict: InjuryConflict,
  areas: InjuryArea[]
): string | null {
  const alt = conflict.saferAlternative;
  if (!alt) return null;
  return injuryConflict(alt, areas) ? null : alt;
}

// ---------------------------------------------------------------------------
// Prompt context for a form check
// ---------------------------------------------------------------------------

export interface HealthProfileForPrompt {
  injuryHistory?: string | null;
  injuryAreas?: string[] | null;
  medicalConditions?: string[] | null;
  medicalNotes?: string | null;
}

/**
 * What a form check should know about the person in the photo.
 *
 * A form check was previously just an exercise name and some images, so someone
 * who had told the app about their lower back got the same four generic
 * corrections as everyone else — on the one screen where a specific cue is worth
 * the most. The cues it asks for are the ones that protect the area, and the
 * framing stays non-diagnostic: it may say a position looks risky for them, it
 * may not tell them anything about their injury.
 */
export function buildFormCheckHealthContext(profile: HealthProfileForPrompt): string {
  const areas = normalizeInjuryAreas(profile.injuryAreas);
  const parts: string[] = [];

  if (areas.length || profile.injuryHistory?.trim()) {
    const reported = [
      areas.length ? describeInjuryAreas(areas) : "",
      profile.injuryHistory?.trim().slice(0, 300) ?? "",
    ]
      .filter(Boolean)
      .join(" — ");

    parts.push(
      `\nThis person has reported the following problem area(s): ${reported}. Prioritise corrections and cues that protect those areas specifically, and if the position in the photo looks like it would load one of them badly, say so in "safetyWarnings" and give the single change that would fix it. Suggest an easier variation of this exercise if the movement itself looks poorly suited to them. Do not tell them anything about their injury, what it is, or how to treat it — you are commenting on what the photo shows and nothing else.`
    );
  }

  const health = healthContextBlock(profile.medicalConditions, profile.medicalNotes);
  if (health) parts.push(health);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Calorie guards
// ---------------------------------------------------------------------------

export interface CalorieGuard {
  /** The condition this came from, so callers can explain themselves. */
  condition: MedicalCondition;
  /** Largest deficit below TDEE that is allowed. 0 means no deficit at all. */
  maxDeficitKcal: number;
  /** Hard floor as a share of TDEE, which catches small-TDEE edge cases. */
  minFractionOfTdee: number;
  /** Floor on carbohydrate grams, for the conditions where cutting them is the risk. */
  minCarbGrams: number;
  /** One sentence, written to the user, saying what was held back and why. */
  reason: string;
}

/**
 * Per-condition limits on how aggressive a calorie target may be.
 *
 * These mirror the wording of the directives in lib/medical-conditions rather
 * than adding new positions: pregnancy is the one that says "no deficit" and so
 * is the one that gets zero. The others say "not aggressive", which is a cap,
 * not a block — refusing to let someone with a disordered-eating history lose
 * weight at all would be its own harm, and is not what the directive asks for.
 */
const CALORIE_GUARDS: Partial<Record<MedicalCondition, Omit<CalorieGuard, "condition">>> = {
  pregnant_or_postpartum: {
    maxDeficitKcal: 0,
    minFractionOfTdee: 1,
    minCarbGrams: 150,
    reason:
      "Your target is set at maintenance rather than a deficit, because you told us you're pregnant or postpartum. Your doctor or midwife should be the one to guide any change to that.",
  },
  disordered_eating_history: {
    maxDeficitKcal: 250,
    minFractionOfTdee: 0.85,
    minCarbGrams: 130,
    reason:
      "Your deficit is capped at a gentle 250 calories, based on what you shared about your history with food. Steady beats aggressive here.",
  },
  diabetes_type_1: {
    maxDeficitKcal: 300,
    minFractionOfTdee: 0.85,
    minCarbGrams: 150,
    reason:
      "Your deficit is kept modest and your carbs are kept up, because you reported type 1 diabetes. Anything glucose- or insulin-related is your care team's call, not ours.",
  },
  diabetes_type_2: {
    maxDeficitKcal: 500,
    minFractionOfTdee: 0.8,
    minCarbGrams: 130,
    reason:
      "Your carbs are kept at a moderate level rather than cut hard, because you reported type 2 diabetes. Run any significant change past your doctor.",
  },
  pcos: {
    maxDeficitKcal: 350,
    minFractionOfTdee: 0.85,
    minCarbGrams: 120,
    reason:
      "Your deficit is kept moderate rather than steep, based on the PCOS you reported — restrictive dieting tends to backfire here.",
  },
};

/**
 * The strictest guard across every condition reported, or null if none apply.
 *
 * Strictest rather than first, so someone who reports two conditions gets the
 * more conservative of the two on every axis independently.
 */
export function calorieGuardFor(conditions: unknown): CalorieGuard | null {
  const reported = normalizeConditions(conditions);
  const guards = reported
    .map((c) => {
      const g = CALORIE_GUARDS[c];
      return g ? { condition: c, ...g } : null;
    })
    .filter((g): g is CalorieGuard => g !== null);

  if (!guards.length) return null;

  // The condition that drives the tightest calorie limit is the one whose
  // explanation the user sees — that is the one actually shaping their target.
  const strictestOnCalories = guards.reduce((a, b) =>
    b.maxDeficitKcal < a.maxDeficitKcal ? b : a
  );

  return {
    condition: strictestOnCalories.condition,
    reason: strictestOnCalories.reason,
    maxDeficitKcal: Math.min(...guards.map((g) => g.maxDeficitKcal)),
    minFractionOfTdee: Math.max(...guards.map((g) => g.minFractionOfTdee)),
    minCarbGrams: Math.max(...guards.map((g) => g.minCarbGrams)),
  };
}

/** Applies a guard to a calorie figure. Never raises it above what was asked for. */
export function guardCalories(calories: number, tdee: number, guard: CalorieGuard | null): number {
  if (!guard) return calories;
  const floor = Math.max(tdee - guard.maxDeficitKcal, tdee * guard.minFractionOfTdee);
  return Math.max(calories, Math.round(floor));
}

/**
 * Whether a weight-loss goal should be presented to the meal planner as such.
 *
 * Used to neutralise the goal string before it reaches a prompt, so the planner
 * is never asked to build a deficit for someone whose target is maintenance —
 * the failure we were otherwise one prompt-following lapse away from was the
 * coach declining an aggressive cut while the Nutrition tab served one.
 */
export function goalForPlanner(goal: string, guard: CalorieGuard | null): string {
  if (!guard || guard.maxDeficitKcal > 0) return goal;
  return goal === "fat_loss" ? "maintenance" : goal;
}
