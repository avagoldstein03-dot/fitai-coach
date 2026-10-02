/**
 * Keyword mapping from an exercise name to the muscle groups it trains.
 *
 * Used to check that a generated exercise actually belongs on the day it was
 * put on — the generator once placed a barbell back squat on a back day, and
 * nothing downstream could tell. A richer sibling of frontend/lib/exercise-
 * muscles.ts, which drives the muscle-diagram preview; this copy exists because
 * validation runs server-side and needs the fuller vocabulary.
 *
 * Order matters: the first entry whose keyword appears in the name wins, so
 * specific phrases ("leg curl") are listed before the general words they
 * contain ("curl") would otherwise catch.
 */

export const MUSCLE_GROUPS = [
  "chest", "shoulders", "triceps", "biceps", "forearms",
  "back", "lats", "traps", "lower back",
  "quads", "hamstrings", "glutes", "calves", "adductors", "abductors",
  "abs", "obliques", "cardio",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const MUSCLE_SET = new Set<string>(MUSCLE_GROUPS);

/** Keeps only values from the canonical vocabulary, so a model-invented group
 *  ("posterior chain", "core stability") cannot quietly satisfy validation. */
export function normalizeMuscles(input: unknown): MuscleGroup[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<MuscleGroup>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const m = raw.trim().toLowerCase();
    if (MUSCLE_SET.has(m)) out.add(m as MuscleGroup);
  }
  return [...out];
}

interface Rule { keywords: string[]; muscles: MuscleGroup[] }

const RULES: Rule[] = [
  // Specific phrases first — "leg curl" must not be read as a biceps curl, and
  // "face pull" must not be read as a pull-up.
  { keywords: ["leg curl", "hamstring curl", "lying curl", "nordic"], muscles: ["hamstrings"] },
  // Named before the general "curl" rule: a Jefferson curl is spinal flexion,
  // not a biceps exercise, and the generic rule gets it exactly wrong.
  { keywords: ["jefferson curl"], muscles: ["lower back", "hamstrings"] },
  { keywords: ["leg extension", "knee extension"], muscles: ["quads"] },
  { keywords: ["calf raise", "calf press", "heel raise"], muscles: ["calves"] },
  { keywords: ["face pull"], muscles: ["shoulders", "back"] },
  { keywords: ["rear delt", "reverse fly", "reverse flye"], muscles: ["shoulders", "back"] },
  { keywords: ["lateral raise", "side raise", "front raise", "upright row"], muscles: ["shoulders"] },
  { keywords: ["shrug"], muscles: ["traps"] },

  // Hinge and glute work
  // "glute kickback" is spelled out rather than bare "kickback", which would
  // also swallow a triceps kickback.
  { keywords: ["hip thrust", "glute bridge", "glute kickback", "pull-through", "pull through"], muscles: ["glutes"] },
  { keywords: ["abduction", "abductor", "lateral band", "clamshell"], muscles: ["abductors", "glutes"] },
  { keywords: ["adduction", "adductor"], muscles: ["adductors"] },
  { keywords: ["deadlift", "rdl", "romanian", "good morning", "back extension", "hyperextension"], muscles: ["hamstrings", "glutes", "lower back"] },
  { keywords: ["kettlebell swing", "swing"], muscles: ["hamstrings", "glutes"] },

  // Knee-dominant
  { keywords: ["squat", "leg press", "lunge", "step up", "step-up", "split squat", "hack"], muscles: ["quads", "glutes", "hamstrings"] },

  // Push
  { keywords: ["bench press", "chest press", "push up", "push-up", "pushup", "incline press", "decline press", "chest fly", "chest flye", "pec deck", "cable crossover"], muscles: ["chest", "triceps", "shoulders"] },
  { keywords: ["overhead press", "shoulder press", "military press", "arnold press", "push press"], muscles: ["shoulders", "triceps"] },
  { keywords: ["dip"], muscles: ["chest", "triceps"] },
  { keywords: ["tricep", "triceps", "skull crusher", "pushdown", "pressdown", "overhead extension", "kickback"], muscles: ["triceps"] },

  // Pull
  { keywords: ["pull up", "pull-up", "pullup", "chin up", "chin-up", "chinup", "pulldown", "pull down", "lat prayer"], muscles: ["back", "lats", "biceps"] },
  { keywords: ["row"], muscles: ["back", "lats", "biceps"] },
  { keywords: ["pullover"], muscles: ["lats", "chest"] },
  { keywords: ["curl"], muscles: ["biceps", "forearms"] },

  // Core
  { keywords: ["plank", "crunch", "sit up", "sit-up", "situp", "leg raise", "knee raise", "dead bug", "ab wheel", "rollout", "hollow", "v-up", "toes to bar"], muscles: ["abs"] },
  { keywords: ["russian twist", "oblique", "woodchop", "wood chop", "side bend", "pallof", "anti-rotation", "bicycle"], muscles: ["abs", "obliques"] },

  // Loaded carries and conditioning
  { keywords: ["farmer", "carry", "suitcase"], muscles: ["forearms", "abs", "traps"] },
  { keywords: ["treadmill", "run", "jog", "bike", "cycling", "row erg", "elliptical", "stair", "jump rope", "sprint", "burpee", "mountain climber", "battle rope"], muscles: ["cardio"] },
];

/**
 * Muscle groups an exercise trains. Empty when the name is not recognised.
 *
 * First match wins. Accumulating every matching rule made "Seated Leg Curl"
 * come back as hamstrings *and* biceps, because the specific "leg curl" rule
 * and the general "curl" rule both matched — which would let a biceps curl pass
 * validation on a hamstring day.
 */
export function musclesFor(exerciseName: string): MuscleGroup[] {
  const name = exerciseName.toLowerCase();
  for (const { keywords, muscles } of RULES) {
    if (keywords.some((k) => name.includes(k))) return [...muscles];
  }
  return [];
}

/**
 * Muscle groups a day's focus label covers.
 *
 * The label is free text written by the model ("Glutes & Hamstrings", "Upper
 * Body - Push", "Back & Biceps"), so this reads it generously: named muscles
 * first, then the common split words, which expand to the groups they imply.
 */
export function musclesForFocus(focus: string | undefined | null): MuscleGroup[] {
  if (!focus) return [];
  const f = focus.toLowerCase();
  const found = new Set<MuscleGroup>();

  const direct: Array<[string, MuscleGroup[]]> = [
    ["glute", ["glutes"]],
    ["hamstring", ["hamstrings"]],
    ["quad", ["quads"]],
    ["calf", ["calves"]],
    ["calves", ["calves"]],
    ["chest", ["chest"]],
    ["pec", ["chest"]],
    ["shoulder", ["shoulders"]],
    ["delt", ["shoulders"]],
    ["tricep", ["triceps"]],
    ["bicep", ["biceps"]],
    ["arm", ["biceps", "triceps", "forearms"]],
    ["forearm", ["forearms"]],
    ["trap", ["traps"]],
    ["lat", ["lats", "back"]],
    ["back", ["back", "lats", "lower back"]],
    ["core", ["abs", "obliques"]],
    ["ab", ["abs", "obliques"]],
    ["oblique", ["obliques"]],
    ["cardio", ["cardio"]],
    ["conditioning", ["cardio"]],
  ];
  for (const [word, muscles] of direct) {
    if (f.includes(word)) muscles.forEach((m) => found.add(m));
  }

  // Split vocabulary — these imply a set of muscles without naming them.
  if (/\bpush\b/.test(f)) ["chest", "shoulders", "triceps"].forEach((m) => found.add(m as MuscleGroup));
  if (/\bpull\b/.test(f)) ["back", "lats", "biceps", "traps"].forEach((m) => found.add(m as MuscleGroup));
  if (/\bleg|lower\b/.test(f)) ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"].forEach((m) => found.add(m as MuscleGroup));
  if (/\bupper\b/.test(f)) ["chest", "shoulders", "triceps", "back", "lats", "biceps", "traps"].forEach((m) => found.add(m as MuscleGroup));
  if (/\bfull body|total body\b/.test(f)) {
    ["chest", "shoulders", "triceps", "back", "lats", "biceps", "quads", "hamstrings", "glutes", "calves"]
      .forEach((m) => found.add(m as MuscleGroup));
  }
  if (/\bposterior\b/.test(f)) ["hamstrings", "glutes", "back", "lower back"].forEach((m) => found.add(m as MuscleGroup));

  return [...found];
}
