/**
 * Maps an AI-generated exercise name to one of a small, fixed set of
 * movement-pattern demo clips (scripts/generate-exercise-videos.mjs).
 *
 * Deliberately category-level, not per-exercise-name: getting exercise form
 * wrong is harmful advice, so the catalog is generated once, manually
 * reviewed for correct form, and reused — not silently generated per
 * AI-invented exercise name.
 *
 * Each category has a male and a female clip so the demo matches the
 * viewing user's onboarding `sex` (see prisma schema). URLs below are
 * populated by hand after running the generation script and reviewing
 * every clip locally (see .generated-exercise-videos/catalog.json).
 */

interface VideoCategory {
  keywords: string[];
  libraryId: string;
  videoUrlMale: string;
  videoUrlFemale: string;
}

// Order matters: getVideoForExercise takes the FIRST matching entry, so more
// specific multi-word keywords (e.g. "hamstring curl") must be listed before
// more generic ones they contain (e.g. "curl"), or the generic entry would
// always shadow the specific one.
//
// Keywords are deliberately narrow, not just "similar muscle group" — a
// keyword only belongs on a category if that category's clip actually shows
// the same equipment and movement pattern. "leg press" used to map to the
// squat clip (different machine, different movement entirely) and "front
// raise"/"rear delt" mapped to a side lateral raise clip (different plane of
// motion) — both removed below. When in doubt, a keyword is left off and
// that exercise name gets no video (graceful no-match) rather than a
// misleading one, consistent with the "wrong form is harmful advice" stance
// this whole feature is built around.
const EXERCISE_VIDEO_MAP: VideoCategory[] = [
  { keywords: ["bench press", "chest press", "push up", "push-up", "pushup", "incline press", "decline press"], libraryId: "horizontalPress", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["dip"], libraryId: "dip", videoUrlMale: "", videoUrlFemale: "" },
  // "leg press", "lunge", "step up"/"step-up" removed — different equipment/
  // movement from a standing barbell back squat. "goblet squat" still
  // matches via the plain "squat" substring below.
  { keywords: ["squat"], libraryId: "squat", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/squat-eb4af161-abb7-4a2c-9284-2717735f75af.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/squat_female-3940a702-519e-4c70-bec4-3ce4b51a904d.mp4" },
  { keywords: ["deadlift", "rdl", "good morning"], libraryId: "hinge", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/hinge-f0f93a91-a743-4f15-a7e4-b3bba6256187.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/hinge_female-51816cfb-ead7-4909-950b-92cd66666380.mp4" },
  // "row" removed — a horizontal pull, different plane of motion from a
  // vertical pull-up/lat pulldown. No horizontal-row category/clip exists yet.
  { keywords: ["pull up", "pull-up", "pullup", "chin up", "chin-up", "lat pulldown", "pulldown"], libraryId: "verticalPull", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["overhead press", "shoulder press", "military press", "arnold press", "push press"], libraryId: "overheadPress", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/overheadPress-21679944-7b60-41a7-a69c-94507719dcfb.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/overheadPress_female-83d8f112-abad-42cc-a6b3-2de81f911e9d.mp4" },
  // "front raise" and "rear delt" removed — different planes of motion
  // (front vs. side) from a lateral raise.
  { keywords: ["lateral raise"], libraryId: "lateralRaise", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/lateralRaise-f86cd5ce-022f-45d3-bec2-a52322ca9ed2.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/lateralRaise_female-320c8ded-1314-486b-8729-ad3b3f890ad8.mp4" },
  { keywords: ["hamstring curl", "leg curl"], libraryId: "hamstringCurl", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["leg extension"], libraryId: "legExtension", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["curl"], libraryId: "curl", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/curl-f7af7c43-fa04-4adb-931a-561b65d34a3f.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/curl_female-319702fd-b3e3-42a8-a81f-1a7ebdf25681.mp4" },
  // "skull crusher" and "kickback" removed — meaningfully different
  // positions/equipment from a standing cable pushdown.
  { keywords: ["pushdown"], libraryId: "tricepExtension", videoUrlMale: "", videoUrlFemale: "" },
  // Narrowed to just "plank" — crunch/sit-up/leg raise/russian twist/ab
  // wheel are all visually distinct movements from a plank hold.
  { keywords: ["plank"], libraryId: "core", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/core_male-a0414ebe-5206-42fb-bc18-3bea72245388.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/core_female-d8375967-0b0c-46c0-916a-f2243a0d5b1c.mp4" },
  { keywords: ["calf raise"], libraryId: "calfRaise", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["hip thrust", "glute bridge"], libraryId: "hipThrust", videoUrlMale: "", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/hipThrust-19180df4-fc5f-4332-9b26-d0a2ea207203.mp4" },
  { keywords: ["face pull"], libraryId: "facePull", videoUrlMale: "", videoUrlFemale: "" },
  { keywords: ["shrug"], libraryId: "shrug", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/shrug-0ffc8c3c-56b6-46b2-b848-d9266bf8df9c.mp4", videoUrlFemale: "" },
  // Bare "carry" removed — over-matches suitcase/overhead carry variants
  // that look meaningfully different from a two-handed farmer's carry.
  { keywords: ["farmer"], libraryId: "farmerCarry", videoUrlMale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/farmerCarry-6c9c8b3e-7c1f-485b-a21b-8fd1db0a75af.mp4", videoUrlFemale: "https://fitai-coach-storage.s3.us-east-1.amazonaws.com/exercise-videos/farmerCarry_female-bc1a9fbe-d427-4c35-87b2-d2f53ac9801c.mp4" },
];

// Pure keyword matching, independent of whether that category has a reviewed
// clip yet — kept separate from getVideoForExercise so the ordering logic
// (specific-before-generic) stays testable as more categories get populated.
export function resolveVideoCategory(exerciseName: string): string | null {
  const key = exerciseName.toLowerCase();
  const match = EXERCISE_VIDEO_MAP.find(({ keywords }) => keywords.some((k) => key.includes(k)));
  return match?.libraryId ?? null;
}

// `sex` mirrors User.sex ("male" | "female" | "other" | null/undefined).
// Prefers the matching-gender clip; falls back to whichever variant exists
// if the preferred one hasn't been generated yet, and defaults unset/"other"
// to the male variant. Returns null only if the category has no clip at all.
export function getVideoForExercise(
  exerciseName: string,
  sex?: string | null
): { libraryId: string; videoUrl: string } | null {
  const key = exerciseName.toLowerCase();
  const match = EXERCISE_VIDEO_MAP.find(({ keywords }) => keywords.some((k) => key.includes(k)));
  if (!match) return null;
  const preferred = sex === "female" ? match.videoUrlFemale : match.videoUrlMale;
  const videoUrl = preferred || match.videoUrlFemale || match.videoUrlMale;
  if (!videoUrl) return null;
  return { libraryId: match.libraryId, videoUrl };
}
