// Broad movement-pattern classification for an exercise name, used to pick
// which whole-diagram animation style MuscleDiagramSVG plays (a vertical
// bob for a squat, a scale pulse for a press, etc.) — not muscle groups
// (see exercise-muscles.ts for that), the *kind of motion* instead.
export type MovementCategory = "squat" | "hinge" | "press" | "pull" | "curl" | "core" | "calf";

const CATEGORY_MAP: Array<{ keywords: string[]; category: MovementCategory }> = [
  { keywords: ["squat", "leg press", "lunge", "step up", "step-up", "goblet"], category: "squat" },
  { keywords: ["deadlift", "rdl", "good morning", "hip thrust", "glute bridge"], category: "hinge" },
  {
    keywords: [
      "bench press", "chest press", "push up", "push-up", "pushup", "incline press",
      "decline press", "overhead press", "shoulder press", "military press",
      "arnold press", "push press", "dip", "fly", "flye",
    ],
    category: "press",
  },
  { keywords: ["row", "pull up", "pull-up", "pullup", "chin up", "chin-up", "lat pulldown", "pulldown", "face pull"], category: "pull" },
  { keywords: ["curl", "tricep", "skull crusher", "pushdown", "kickback"], category: "curl" },
  { keywords: ["plank", "crunch", "sit up", "sit-up", "leg raise", "russian twist", "ab wheel"], category: "core" },
  { keywords: ["calf raise"], category: "calf" },
];

// Returns null when nothing matches — callers should fall back to no motion
// rather than guessing, same as findExerciseMovement did for the (reverted)
// stock-photo approach.
export function getMovementCategory(exerciseName: string): MovementCategory | null {
  const key = exerciseName.toLowerCase();
  for (const { keywords, category } of CATEGORY_MAP) {
    if (keywords.some((k) => key.includes(k))) return category;
  }
  return null;
}
