#!/usr/bin/env node
/**
 * One-off asset generation: creates a small, fixed catalog of short AI-generated
 * exercise-form demo clips (one per movement-pattern category, not per exercise
 * name) via OpenAI Sora-2, and uploads each to S3.
 *
 * This is NOT a runtime endpoint. Run it once, manually review every clip for
 * actually-correct form (getting exercise form wrong is harmful advice — this
 * review step is the real safety gate, not optional), then paste the printed
 * category->url map into backend/lib/exercise-video-catalog.ts by hand.
 *
 * Usage:
 *   node scripts/generate-exercise-videos.mjs
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import AWS from "aws-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../.generated-exercise-videos");

for (const envPath of [path.join(__dirname, "../.env"), path.join(__dirname, "../backend/.env")]) {
  try {
    const envText = fs.readFileSync(envPath, "utf8");
    for (const line of envText.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] ??= rest.join("=").trim();
    }
  } catch {}
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("Set OPENAI_API_KEY (or add it to backend/.env) first.");
  process.exit(1);
}

for (const k of ["AWS_S3_BUCKET", "AWS_S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
  if (!process.env[k]) {
    console.error(`Set ${k} (or add it to backend/.env) first.`);
    process.exit(1);
  }
}

const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const BUCKET = process.env.AWS_S3_BUCKET;

const STYLE =
  "Realistic gym setting, clean lighting, single person performing the exercise with strict, textbook-correct form, " +
  "full range of motion clearly visible, side or three-quarter camera angle, no text overlays, no other people. " +
  "The person moves continuously through one full repetition over the entire duration of the clip: starting position, " +
  "smoothly through the full range of motion, and back to the starting position, ending back at the start ready to " +
  "repeat — the motion never pauses or holds still at any single position for more than an instant.";

// Bare setting/camera description, no repetition-count language — used by the
// explicit two-rep, phase-by-phase prompts below, for categories where the
// generic STYLE's single vague "one repetition" instruction kept producing a
// clip that just holds one static position (usually the hardest/peak-effort
// position) for nearly the whole 8 seconds instead of actually moving.
const SETTING =
  "Realistic gym setting, clean lighting, side or three-quarter camera angle, no text overlays, no other people, strict textbook-correct form.";

// Second attempt at the same five categories: front-facing camera instead of
// side/three-quarter, and framed as an authentic self-recorded workout clip
// rather than a posed photoshoot — testing whether the side-angle "hero shot"
// framing was contributing to the model freezing at the peak-tension position.
const SETTING_FRONT =
  "Realistic gym setting, clean lighting, camera positioned directly in front of the person at chest height (not a side view), " +
  "filmed like an authentic phone video someone recorded of their own workout set, not a posed photoshoot or hero shot. " +
  "No text overlays, no other people, strict textbook-correct form.";

// ── Movement-pattern categories ────────────────────────────────────────────
// Mirrors the keyword groupings in frontend/lib/exercise-muscles.ts — one
// clip per pattern, not per exercise name, to keep the catalog small, fixed,
// and reviewable.
const CATEGORIES = [
  // These five (horizontalPress, dip, verticalPull, tricepExtension,
  // facePull) previously got stuck holding one static position — usually the
  // hardest/peak-effort point of the lift — for nearly the whole clip despite
  // the generic STYLE's "one full repetition" instruction. Rewritten with
  // explicit two-rep, phase-by-phase scripts and a much more forceful
  // never-static instruction to fight that failure mode directly.
  { key: "horizontalPress", prompt: `A person performing two complete repetitions of a barbell bench press on a flat bench: starting with arms fully extended holding the bar above the chest, lowering the bar smoothly and under control all the way down to touch the chest, then pressing the bar back up to full arm extension — then repeating that lowering-and-pressing motion a second time. The bar and the person's arms are visibly moving up or down in nearly every frame of the clip; the person never holds a fixed position for more than half a second. ${SETTING_FRONT}` },
  { key: "dip",              prompt: `A person performing two complete repetitions of triceps dips on a dip station with two parallel dip bars (not a cable machine, not a lat pulldown machine — the body is suspended in the air between two bars, legs bent behind): starting at the top with arms fully locked out, lowering the body smoothly and under control until the upper arms are about parallel to the ground, then pressing back up to full lockout — then repeating that lowering-and-pressing motion a second time. The body is visibly moving up or down in nearly every frame of the clip; the person never holds a fixed position for more than half a second. ${SETTING_FRONT}` },
  { key: "squat",            prompt: `A person performing a barbell back squat, descending to full depth and standing back up. ${STYLE}` },
  { key: "hinge",            prompt: `A person performing a conventional barbell deadlift with a flat back, hinging at the hips. ${STYLE}` },
  { key: "verticalPull",     prompt: `A person performing two complete repetitions of a strict pull-up on a pull-up bar: starting at a full dead hang with arms completely straight, pulling the body upward smoothly until the chin clears the bar, then lowering back down under control to a full dead hang — then repeating that pulling-and-lowering motion a second time. The body is visibly moving up or down in nearly every frame of the clip; the person never holds a fixed position for more than half a second. ${SETTING_FRONT}` },
  { key: "overheadPress",    prompt: `A person performing a standing barbell overhead press, pressing straight up without arching the back. ${STYLE}` },
  { key: "lateralRaise",     prompt: `A person performing standing dumbbell lateral raises, raising arms to shoulder height with a slight elbow bend. ${STYLE}` },
  { key: "curl",             prompt: `A person performing standing dumbbell bicep curls with strict form, no swinging. ${STYLE}` },
  { key: "tricepExtension",  prompt: `A person performing two complete repetitions of a cable triceps pushdown with a rope attachment: starting with elbows bent about 90 degrees and hands near the chest, extending the arms smoothly down to full lockout with elbows pinned to the sides, then bending the elbows back up to the starting position — then repeating that pushing-and-returning motion a second time. The hands and forearms are visibly moving in nearly every frame of the clip; the person never holds a fixed position for more than half a second. ${SETTING_FRONT}` },
  // A plank is an isometric hold, not a rep — deliberately doesn't reuse the
  // shared STYLE's "one full repetition" language, which doesn't apply here.
  { key: "core",             prompt: "A person performing a forearm plank hold: elbows and forearms flat on the ground directly beneath the shoulders, body forming one straight line from head to heels, core engaged, holding this exact position steadily for the entire clip without moving up or down. Realistic gym setting, clean lighting, side camera angle, no text overlays, no other people, strict correct form throughout." },
  { key: "calfRaise",        prompt: `A person performing standing calf raises on a raised platform, full stretch at the bottom and full extension at the top. ${STYLE}` },
  { key: "hipThrust",        prompt: `A person performing a barbell hip thrust with their upper back on a bench, driving the hips up to full extension. ${STYLE}` },
  { key: "facePull",         prompt: `A person performing two complete repetitions of a cable face pull with a rope attachment: starting with arms extended forward gripping the rope, pulling the rope back toward the face smoothly with elbows high and out to the sides, then extending the arms back forward to the starting position — then repeating that pulling-and-returning motion a second time. The hands and arms are visibly moving in nearly every frame of the clip; the person never holds a fixed position for more than half a second. ${SETTING_FRONT}` },
  { key: "shrug",            prompt: `A person performing standing barbell shrugs, elevating the shoulders straight up without rolling them. ${STYLE}` },
  { key: "hamstringCurl",    prompt: `A person performing a seated hamstring curl machine exercise, curling the pad down with control. ${STYLE}` },
  { key: "legExtension",     prompt: `A person performing a seated leg extension machine exercise, extending the legs to full lockout with control. ${STYLE}` },
  { key: "farmerCarry",      prompt: `A person performing a farmer's carry, walking forward holding a heavy dumbbell in each hand with an upright posture. ${STYLE}` },
];

async function pollUntilComplete(id) {
  while (true) {
    const res = await fetch(`https://api.openai.com/v1/videos/${id}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Poll failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(`Generation failed: ${JSON.stringify(data.error)}`);
    process.stdout.write(`  ...${data.status} (${data.progress ?? 0}%)\r`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function uploadToS3(buffer, key) {
  await s3
    .putObject({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: "video/mp4" })
    .promise();
  return `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const catalog = {};

// Optionally regenerate just a subset, e.g. after a partial run hit a billing
// cap or a specific clip failed review:
//   node scripts/generate-exercise-videos.mjs dip hinge verticalPull
// Optionally request a specific gendered variant of a category (for the
// male/female-matched catalog) via `key:male` or `key:female`:
//   node scripts/generate-exercise-videos.mjs squat:female hipThrust:male
const args = process.argv.slice(2);
const requests = args.length
  ? args.map((arg) => {
      const [key, gender] = arg.split(":");
      const base = CATEGORIES.find((c) => c.key === key);
      if (!base) throw new Error(`Unknown category "${key}"`);
      const prompt = gender ? base.prompt.replace("A person performing", `A ${gender} person performing`) : base.prompt;
      const outKey = gender ? `${key}_${gender}` : key;
      return { outKey, prompt };
    })
  : CATEGORIES.map((c) => ({ outKey: c.key, prompt: c.prompt }));
if (args.length) console.log(`Running only: ${requests.map((r) => r.outKey).join(", ")}`);

for (const { outKey: key, prompt } of requests) {
  console.log(`\nGenerating "${key}"...`);

  const genRes = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: "sora-2", prompt, seconds: "8", size: "720x1280" }),
  });
  if (!genRes.ok) {
    console.error(`  Failed to queue (${genRes.status}):`, await genRes.text());
    continue;
  }
  const job = await genRes.json();

  let completed;
  try {
    completed = await pollUntilComplete(job.id);
  } catch (err) {
    console.error(`  ${err.message}`);
    continue;
  }
  console.log(`  Completed. Downloading...`);

  const contentRes = await fetch(`https://api.openai.com/v1/videos/${completed.id}/content`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!contentRes.ok) {
    console.error(`  Failed to download content (${contentRes.status})`);
    continue;
  }
  const buffer = Buffer.from(await contentRes.arrayBuffer());

  // Save locally too, for the manual review pass, before it ever gets
  // committed anywhere or wired up.
  const localPath = path.join(OUT_DIR, `${key}.mp4`);
  fs.writeFileSync(localPath, buffer);
  console.log(`  Saved local copy: ${localPath} (${(buffer.length / 1024).toFixed(0)} KB)`);

  const s3Key = `exercise-videos/${key}-${crypto.randomUUID()}.mp4`;
  const url = await uploadToS3(buffer, s3Key);
  console.log(`  Uploaded: ${url}`);

  catalog[key] = url;
}

console.log("\n\n=== Category -> S3 URL map (review clips locally before using these!) ===");
console.log(JSON.stringify(catalog, null, 2));

fs.writeFileSync(path.join(OUT_DIR, "catalog.json"), JSON.stringify(catalog, null, 2));
console.log(`\nAlso written to ${path.join(OUT_DIR, "catalog.json")}`);
