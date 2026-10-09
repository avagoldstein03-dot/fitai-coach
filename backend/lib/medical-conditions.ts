/**
 * Self-reported health conditions collected at onboarding.
 *
 * The point is not to diagnose anything or to tailor treatment — it is to make
 * the app's advice more conservative where that matters. A fixed list rather
 * than free text alone, because free text gets skipped or written vaguely, and
 * because a known key can drive a specific, reviewed instruction instead of
 * hoping a model reads a sentence correctly.
 */

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

const VALID = new Set<string>(MEDICAL_CONDITIONS);

/** Drops anything not on the list, so a crafted request cannot inject prose
 *  into the coaching directives through this field. */
export function normalizeConditions(input: unknown): MedicalCondition[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<MedicalCondition>();
  for (const raw of input) {
    if (typeof raw === "string" && VALID.has(raw)) out.add(raw as MedicalCondition);
  }
  return [...out];
}

export const MAX_MEDICAL_NOTES_LENGTH = 300;

/**
 * What each condition changes about the advice.
 *
 * Deliberately narrow. Each line adjusts caution, intensity or emphasis — none
 * of them treat, diagnose, or tell the user what their condition means. Where a
 * condition genuinely needs clinical input, the instruction is to say so.
 */
const CONDITION_DIRECTIVES: Record<Exclude<MedicalCondition, "prefer_not_to_say">, string> = {
  high_blood_pressure:
    "They have reported high blood pressure. Avoid recommending maximal or near-maximal straining efforts and prolonged breath-holding (the Valsalva manoeuvre), favour controlled breathing through lifts, and be measured about very high-intensity conditioning. Suggest they clear new high-intensity work with their doctor.",
  heart_condition:
    "They have reported a heart condition. Keep intensity recommendations conservative, do not push maximal-effort or all-out interval work, and whenever intensity comes up, say plainly that they should confirm what is appropriate with their doctor or cardiologist.",
  diabetes_type_1:
    "They have reported type 1 diabetes. Do not advise on insulin, medication or blood glucose management at all — that is their medical team's. You may discuss training and food generally, but avoid prescribing fasted training or aggressive carbohydrate restriction, and point them to their care team for anything glucose-related.",
  diabetes_type_2:
    "They have reported type 2 diabetes. Avoid recommending aggressive carbohydrate restriction, extended fasting or very low calorie intakes, and never advise on medication or blood glucose management. Keep nutrition advice general and suggest they run significant changes past their doctor.",
  asthma:
    "They have reported asthma. When recommending conditioning or interval work, suggest a longer warm-up, and note that they should keep their inhaler accessible if they use one. Do not advise on medication.",
  pcos:
    "They have reported PCOS. Keep nutrition advice supportive and non-restrictive, do not promise that training or diet will resolve symptoms, and refer anything hormonal or medical to their doctor.",
  thyroid:
    "They have reported a thyroid condition. Do not attribute weight or energy changes to their thyroid, and do not advise on medication or dosing. Keep training and nutrition advice general and suggest their doctor for anything symptom-related.",
  joint_condition:
    "They have reported a joint condition such as arthritis. Favour lower-impact options and controlled ranges of motion, offer substitutions where a movement is likely to aggravate a joint, and frame all of it as general guidance rather than treatment.",
  pregnant_or_postpartum:
    "They have reported being pregnant or postpartum. Do not recommend a calorie deficit or weight loss. Keep training advice conservative, avoid supine core work and heavy maximal lifting unless they say their clinician has cleared it, and state clearly that their doctor or midwife should guide what is appropriate.",
  disordered_eating_history:
    "They have reported a history of disordered eating. This changes how you talk about food and the body: do not suggest aggressive deficits, extended fasting, cutting food groups, or 'earning' food through exercise; do not emphasise weight, scale numbers or appearance; keep the focus on strength, energy, consistency and how they feel. If they ask for an aggressive cut or express distress about food or body image, decline gently and suggest speaking to a professional who specialises in this.",
};

/** Instructions for the AI, given the conditions reported. Empty when none apply. */
export function medicalDirectives(
  conditions: string[] | null | undefined,
  notes?: string | null
): string[] {
  const out: string[] = [];
  for (const c of normalizeConditions(conditions)) {
    if (c === "prefer_not_to_say") continue;
    out.push(CONDITION_DIRECTIVES[c]);
  }
  if (notes && notes.trim()) {
    out.push(
      `They have also noted: "${notes.trim().slice(0, MAX_MEDICAL_NOTES_LENGTH)}". Take it into account when suggesting training or food, be conservative where it is relevant, and treat it as context rather than something to advise on medically.`
    );
  }
  if (out.length) {
    out.push(
      "None of the above is a diagnosis and you are not treating any of it. Never tell them what a condition means for them, never suggest starting, stopping or changing a medication, and say plainly when something is a question for their doctor."
    );
  }
  return out;
}

/**
 * The directives as a block ready to drop into a prompt, or "" when none apply.
 *
 * One helper rather than the same template string written out at each call site:
 * six prompts need this now (workout, meal plan, progress review and form check,
 * on both providers), and the earlier copy-paste version is exactly how the meal
 * planner ended up being the one that never got it.
 */
export function healthContextBlock(
  conditions: string[] | null | undefined,
  notes?: string | null
): string {
  const directives = medicalDirectives(conditions, notes);
  if (!directives.length) return "";
  return `\nHEALTH CONTEXT — the client reported the following. Work within it; none of it is a diagnosis and you are not treating any of it.\n${directives
    .map((d) => `- ${d}`)
    .join("\n")}\n`;
}
