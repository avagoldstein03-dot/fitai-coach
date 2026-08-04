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
  { keywords: ["deadlift", "rdl", "good morning"], libraryId: "hinge", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/hinge-f0f93a91-a743-4f15-a7e4-b3bba6256187.mp4" },
  { keywords: ["pull up", "pull-up", "pullup", "chin up", "chin-up", "lat pulldown", "pulldown", "row"], libraryId: "verticalPull", videoUrl: "" },
  { keywords: ["overhead press", "shoulder press", "military press", "arnold press", "push press"], libraryId: "overheadPress", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/overheadPress-21679944-7b60-41a7-a69c-94507719dcfb.mp4" },
  { keywords: ["lateral raise", "front raise", "rear delt"], libraryId: "lateralRaise", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/lateralRaise-f86cd5ce-022f-45d3-bec2-a52322ca9ed2.mp4" },
  { keywords: ["hamstring curl", "leg curl"], libraryId: "hamstringCurl", videoUrl: "" },
  { keywords: ["leg extension"], libraryId: "legExtension", videoUrl: "" },
  { keywords: ["curl"], libraryId: "curl", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/curl-f7af7c43-fa04-4adb-931a-561b65d34a3f.mp4" },
  { keywords: ["tricep", "skull crusher", "pushdown", "kickback"], libraryId: "tricepExtension", videoUrl: "" },
  { keywords: ["plank", "crunch", "sit up", "sit-up", "leg raise", "russian twist", "ab wheel"], libraryId: "core", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/core-91d217f8-6619-419a-a931-0ec272308f72.mp4" },
  { keywords: ["calf raise"], libraryId: "calfRaise", videoUrl: "" },
  { keywords: ["hip thrust", "glute bridge"], libraryId: "hipThrust", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/hipThrust-19180df4-fc5f-4332-9b26-d0a2ea207203.mp4" },
  { keywords: ["face pull"], libraryId: "facePull", videoUrl: "" },
  { keywords: ["shrug"], libraryId: "shrug", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/shrug-0ffc8c3c-56b6-46b2-b848-d9266bf8df9c.mp4" },
  { keywords: ["farmer", "carry"], libraryId: "farmerCarry", videoUrl: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/farmerCarry-6c9c8b3e-7c1f-485b-a21b-8fd1db0a75af.mp4" },
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
