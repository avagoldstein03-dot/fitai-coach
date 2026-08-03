/**
 * Maps an AI-generated exercise name to one of a small, fixed set of
 * movement-pattern demo clips (scripts/generate-exercise-videos.mjs).
 *
 * Deliberately category-level, not per-exercise-name: getting exercise form
 * wrong is harmful advice, so the catalog is generated once, manually
 * reviewed for correct form, and reused — not silently generated per
 * AI-invented exercise name.
 *
 * URLs below are populated by hand after running the generation script and
 * reviewing every clip locally (see .generated-exercise-videos/catalog.json).
 */

interface VideoCategory {
  keywords: string[];
  libraryId: string;
  videoUrl: string;
}

// Order matters: getVideoForExercise takes the FIRST matching entry, so more
// specific multi-word keywords (e.g. "hamstring curl") must be listed before
// more generic ones they contain (e.g. "curl"), or the generic entry would
// always shadow the specific one.
const EXERCISE_VIDEO_MAP: VideoCategory[] = [
  { keywords: ["bench press", "chest press", "push up", "push-up", "pushup", "incline press", "decline press", "fly", "flye"], libraryId: "horizontalPress", videoUrl: "" },
  { keywords: ["dip"], libraryId: "dip", videoUrl: "" },
  { keywords: ["squat", "leg press", "lunge", "step up", "step-up", "goblet"], libraryId: "squat", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/squat-eb4af161-abb7-4a2c-9284-2717735f75af.mp4" },
  { keywords: ["deadlift", "rdl", "good morning"], libraryId: "hinge", videoUrl: "" },
  { keywords: ["pull up", "pull-up", "pullup", "chin up", "chin-up", "lat pulldown", "pulldown", "row"], libraryId: "verticalPull", videoUrl: "" },
  { keywords: ["overhead press", "shoulder press", "military press", "arnold press", "push press"], libraryId: "overheadPress", videoUrl: "" },
  { keywords: ["lateral raise", "front raise", "rear delt"], libraryId: "lateralRaise", videoUrl: "" },
  { keywords: ["hamstring curl", "leg curl"], libraryId: "hamstringCurl", videoUrl: "" },
  { keywords: ["leg extension"], libraryId: "legExtension", videoUrl: "" },
  { keywords: ["curl"], libraryId: "curl", videoUrl: "" },
  { keywords: ["tricep", "skull crusher", "pushdown", "kickback"], libraryId: "tricepExtension", videoUrl: "" },
  { keywords: ["plank", "crunch", "sit up", "sit-up", "leg raise", "russian twist", "ab wheel"], libraryId: "core", videoUrl: "" },
  { keywords: ["calf raise"], libraryId: "calfRaise", videoUrl: "" },
  { keywords: ["hip thrust", "glute bridge"], libraryId: "hipThrust", videoUrl: "" },
  { keywords: ["face pull"], libraryId: "facePull", videoUrl: "" },
  { keywords: ["shrug"], libraryId: "shrug", videoUrl: "" },
  { keywords: ["farmer", "carry"], libraryId: "farmerCarry", videoUrl: "" },
];
// Pure keyword matching, independent of whether that category has a reviewed
// clip yet — kept separate from getVideoForExercise so the ordering logic
// (specific-before-generic) stays testable as more categories get populated.
export function resolveVideoCategory(exerciseName: string): string | null {
  const key = exerciseName.toLowerCase();
  const match = EXERCISE_VIDEO_MAP.find(({ keywords }) => keywords.some((k) => key.includes(k)));
  return match?.libraryId ?? null;
}

export function getVideoForExercise(exerciseName: string): { libraryId: string; videoUrl: string } | null {
  const key = exerciseName.toLowerCase();
  const match = EXERCISE_VIDEO_MAP.find(({ keywords }) => keywords.some((k) => key.includes(k)));
  if (!match || !match.videoUrl) return null;
  return { libraryId: match.libraryId, videoUrl: match.videoUrl };
}
