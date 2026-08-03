// Lightweight, client-side keyword mapping from an exercise name to the muscle
// groups it's likely to work — used to drive the muscle-diagram *preview* on
// the Workouts screen, before an actual Form Check scan exists. This is
// deliberately approximate; the real, exercise-specific muscle list comes
// back from an actual scan and is rendered the same way via MuscleDiagramSVG.
const EXERCISE_MUSCLE_MAP: Array<{ keywords: string[]; muscles: string[] }> = [
  { keywords: ["bench press", "chest press", "push up", "push-up", "pushup", "incline press", "decline press", "fly", "flye"], muscles: ["chest", "triceps", "shoulders"] },
  { keywords: ["dip"], muscles: ["chest", "triceps"] },
  { keywords: ["squat", "leg press", "lunge", "step up", "step-up", "goblet"], muscles: ["quads", "glutes", "hamstrings"] },
  { keywords: ["deadlift", "rdl", "good morning"], muscles: ["hamstrings", "glutes", "lower back"] },
  { keywords: ["pull up", "pull-up", "pullup", "chin up", "chin-up", "lat pulldown", "pulldown", "row"], muscles: ["back", "lats", "biceps"] },
  { keywords: ["overhead press", "shoulder press", "military press", "arnold press", "push press"], muscles: ["shoulders", "triceps"] },
  { keywords: ["lateral raise", "front raise", "rear delt"], muscles: ["shoulders"] },
  { keywords: ["curl"], muscles: ["biceps", "forearms"] },
  { keywords: ["tricep", "skull crusher", "pushdown", "kickback"], muscles: ["triceps"] },
  { keywords: ["plank", "crunch", "sit up", "sit-up", "leg raise", "russian twist", "ab wheel"], muscles: ["abs", "core", "obliques"] },
  { keywords: ["calf raise"], muscles: ["calves"] },
  { keywords: ["hip thrust", "glute bridge"], muscles: ["glutes"] },
  { keywords: ["face pull"], muscles: ["shoulders", "back"] },
  { keywords: ["shrug"], muscles: ["traps"] },
  { keywords: ["hamstring curl", "leg curl"], muscles: ["hamstrings"] },
  { keywords: ["leg extension"], muscles: ["quads"] },
  { keywords: ["farmer", "carry"], muscles: ["forearms", "core", "traps"] },
];

export function getMusclesForExercise(exerciseName: string): string[] {
  const key = exerciseName.toLowerCase();
  const matches = new Set<string>();
  for (const { keywords, muscles } of EXERCISE_MUSCLE_MAP) {
    if (keywords.some((k) => key.includes(k))) {
      muscles.forEach((m) => matches.add(m));
    }
  }
  return [...matches];
}
