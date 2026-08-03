import exercises from "@/assets/exercise-movements.json";

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const STOPWORDS = new Set(["a", "an", "the", "to", "with", "and", "or", "in", "on", "of", "at"]);

interface ExerciseMovementEntry {
  id: string;
  name: string;
  images: [string, string];
}

export interface ExerciseMovement {
  name: string;
  images: [string, string];
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Precomputed once at module load — this dataset is static and bundled.
const INDEX = (exercises as ExerciseMovementEntry[]).map((e) => ({
  entry: e,
  tokens: new Set(tokenize(e.name)),
}));

// Best-effort fuzzy match against the free-exercise-db dataset. Requires
// every word in the query to appear somewhere in the candidate's name
// (full coverage), then prefers whichever matching candidate has the
// fewest *extra* words — i.e. the closest, least-embellished match — over
// resolving to some more specific variant.
export function findExerciseMovement(exerciseName: string): ExerciseMovement | null {
  const queryTokens = new Set(tokenize(exerciseName));
  if (queryTokens.size === 0) return null;

  let best: { entry: ExerciseMovementEntry; extraTokens: number } | null = null;

  for (const { entry, tokens } of INDEX) {
    let coversAll = true;
    for (const t of queryTokens) {
      if (!tokens.has(t)) { coversAll = false; break; }
    }
    if (!coversAll) continue;

    const extraTokens = tokens.size - queryTokens.size;
    if (!best || extraTokens < best.extraTokens) {
      best = { entry, extraTokens };
    }
  }

  if (!best) return null;

  return {
    name: best.entry.name,
    images: [IMAGE_BASE + best.entry.images[0], IMAGE_BASE + best.entry.images[1]],
  };
}
