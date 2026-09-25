// Marketing automation: turns one prompt from the AI UGC library (prompts.json,
// exported from the active-ai-hub artifact) into a rendered talking-avatar video.
//
// Pipeline, all first-party except the TTS step:
//   1. Higgsfield Marketing Studio (V2 SDK) -- avatar image, with the real app
//      screenshot (screenshot-urls.json, extracted from the artifact and
//      hosted on S3) composited in as a reference image, for prompts that have
//      one. Falls back to plain Soul (no screenshot) for "talkinghead"/"needed".
//   2. ElevenLabs                -- turn the prompt's `script` into WAV speech
//   3. S3                        -- host that WAV so Higgsfield can fetch it
//   4. Higgsfield Speak (V1 SDK) -- lipsync the avatar image to the speech
//
// Speak (/v1/speak/higgsfield) is Higgsfield's own endpoint, not a reseller --
// but it only exists in their deprecated V1 client, so its exact result shape
// is confirmed only loosely from their README, not from a live call yet. This
// script logs every raw response so a mismatch is easy to spot on first run.
//
// Usage:
//   node generate-ugc-video.ts list           # print all prompts with their number
//   node generate-ugc-video.ts <promptNumber>  # e.g. node generate-ugc-video.ts 3
//   node generate-ugc-video.ts <n> --image <url> --audio <url>  # resume a failed step 4
//
// Required env vars:
//   backend/.env.local: HF_CREDENTIALS=key-id:key-secret (same one index.ts uses --
//     this script derives the V1 client's separate apiKey/apiSecret from it, so
//     nothing new needs to be added there)
//   backend/.env: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
//     AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET (already used elsewhere in this repo)

import { config, higgsfield } from "@higgsfield/client/v2";
import { HiggsfieldClient, InputImage, InputAudio, SpeakVideoQuality, SpeakDuration } from "@higgsfield/client";
import AWS from "aws-sdk";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try { process.loadEnvFile(path.join(__dirname, "../../.env.local")); } catch {}
try { process.loadEnvFile(path.join(__dirname, "../../.env")); } catch {}

config({ credentials: process.env.HF_CREDENTIALS });

const [hfApiKey, hfApiSecret] = (process.env.HF_CREDENTIALS ?? "").split(":");
// Speak renders can genuinely take longer than the SDK's 5-minute default poll
// ceiling -- bump it rather than have a slow-but-successful render come back
// as a client-side timeout.
const speakClient = new HiggsfieldClient({ apiKey: hfApiKey, apiSecret: hfApiSecret, maxPollTime: 900000 });

const PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
const SCREENSHOTS: Record<string, string> = JSON.parse(fs.readFileSync(path.join(__dirname, "screenshots.json"), "utf8"));
const SCREENSHOT_URLS: Record<string, string> = JSON.parse(fs.readFileSync(path.join(__dirname, "screenshot-urls.json"), "utf8"));

const s3 = new AWS.S3({
  region: process.env.AWS_S3_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const BUCKET = process.env.AWS_S3_BUCKET as string;

function requireEnv(names: string[]) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error("Missing required env vars:", missing.join(", "));
    process.exit(1);
  }
}

async function uploadBufferToS3(buffer: Buffer, folder: string, prefix: string, contentType: string, ext: string) {
  const key = `${folder}/${prefix}-${randomUUID()}.${ext}`;
  await s3.putObject({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }).promise();
  return `https://${BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
}

// Step 1: generate the avatar image matching the prompt's `avatar` + `setting`
// description. When this prompt has a real app screenshot (screenshot-urls.json),
// use Marketing Studio in direct mode -- prompt, then the real screenshot as a
// reference image, then the screenshot's own description folded into the same
// prompt (same order used when doing this by hand in the Higgsfield app) -- so
// the phone in frame shows the actual UI instead of a generic guess. Falls back
// to plain Soul when there's no screenshot for this prompt (talkinghead/needed).
async function generateAvatarImage(promptObj: any): Promise<string> {
  const basePrompt = `${promptObj.avatar} Setting: ${promptObj.setting} Vertical phone-camera selfie framing, natural lighting, photorealistic.`;
  const screenshotUrl = SCREENSHOT_URLS[promptObj.screenshot];
  const screenshotDesc = SCREENSHOTS[promptObj.screenshot];

  let result: any;
  if (screenshotUrl) {
    const prompt = `${basePrompt} The phone screen held in frame must show this exact app screenshot, reproduced accurately: ${screenshotDesc ?? ""}`;
    result = await higgsfield.subscribe("marketing-studio/image", {
      input: { prompt, image_urls: [screenshotUrl], aspect_ratio: "9:16", resolution: "4k", enhance_prompt: false },
      withPolling: true,
    });
    console.log("[marketing-studio] result:", JSON.stringify(result));
  } else {
    console.log(`[marketing-studio] no screenshot for "${promptObj.screenshot}" -- falling back to plain Soul`);
    result = await higgsfield.subscribe("higgsfield-ai/soul/standard", {
      input: { prompt: basePrompt, num_images: 1, aspect_ratio: "9:16", resolution: "2K" },
      withPolling: true,
    });
    console.log("[soul] result:", JSON.stringify(result));
  }

  const imageUrl = result.images?.[0]?.url ?? result.image?.url ?? result.results?.raw?.url;
  if (!imageUrl) throw new Error(`[avatar image] could not find an image URL in: ${JSON.stringify(result)}`);
  if (result.status && result.status !== "completed") {
    throw new Error(`[avatar image] non-completed status: ${result.status}`);
  }
  return imageUrl;
}

// Voice-per-flagship-prompt: only the specific prompt numbers worth cloning a
// dedicated voice for get one (ELEVENLABS_VOICE_ID_PROMPT_<n>). Everything
// else falls back to the single generic ELEVENLABS_VOICE_ID.
function voiceIdForPrompt(promptNumber: number): string {
  const promptVar = `ELEVENLABS_VOICE_ID_PROMPT_${promptNumber}`;
  const promptVoiceId = process.env[promptVar];
  if (promptVoiceId) return promptVoiceId;
  if (process.env.ELEVENLABS_VOICE_ID) {
    console.log(`[elevenlabs] no ${promptVar} set, falling back to generic ELEVENLABS_VOICE_ID`);
    return process.env.ELEVENLABS_VOICE_ID;
  }
  throw new Error(`No voice ID for prompt ${promptNumber} -- set ${promptVar} or a fallback ELEVENLABS_VOICE_ID in backend/.env`);
}

// Step 2: turn the prompt's `script` field into WAV speech via ElevenLabs,
// using whichever cloned voice is assigned to this specific prompt number.
// Speak's input_audio only accepts WAV, so request wav_16000 directly rather
// than converting from mp3 ourselves.
async function generateVoiceAudio(promptObj: any, promptNumber: number): Promise<Buffer> {
  requireEnv(["ELEVENLABS_API_KEY"]);
  const voiceId = voiceIdForPrompt(promptNumber);

  const pacing = (promptObj.pacing || "").toLowerCase();
  const fastPaced = /fast|quick|energetic|excited|rapid/.test(pacing);
  const voice_settings = {
    stability: fastPaced ? 0.35 : 0.5,
    similarity_boost: 0.8,
    style: fastPaced ? 0.6 : 0.35,
    use_speaker_boost: true,
  };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=wav_16000`,
    {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string, "Content-Type": "application/json" },
      body: JSON.stringify({ text: promptObj.script, model_id: "eleven_multilingual_v2", voice_settings }),
    }
  );
  if (!res.ok) throw new Error(`[elevenlabs] failed: ${res.status} ${await res.text()}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[elevenlabs] got ${buffer.length} bytes of WAV audio`);
  return buffer;
}

// Speak rejects input images over ~10 MB ("Input image too large"). Marketing
// Studio's 4k PNGs land right around that line (10.46 MB passed, 11.46 MB
// failed), so anything over the margin is re-encoded as a high-quality JPEG at
// the same resolution -- keeps the in-frame screenshot legible at a fraction of
// the size -- and re-hosted on S3.
const SPEAK_MAX_IMAGE_BYTES = 9_500_000;

async function ensureSpeakSizedImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`[image resize] could not download ${imageUrl}: ${res.status}`);
  const original = Buffer.from(await res.arrayBuffer());
  if (original.length <= SPEAK_MAX_IMAGE_BYTES) return imageUrl;

  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(original).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  console.log(`[image resize] ${original.length} bytes -> ${jpeg.length} bytes JPEG (same resolution)`);
  return uploadBufferToS3(jpeg, "marketing-automation/images", "avatar", "image/jpeg", "jpg");
}

// Step 4: lipsync the avatar image to the voice audio via Higgsfield's own
// (deprecated V1) Speak endpoint.
async function generateTalkingVideo(imageUrl: string, audioUrl: string, promptObj: any): Promise<string> {
  const stylePrompt = `${promptObj.behavior} Camera: ${promptObj.camera} Emotion: ${promptObj.emotion}`;

  // Submit without the SDK's built-in polling and poll manually instead --
  // the built-in poll has thrown spurious timeouts on jobs that actually
  // finished within ~2-3 minutes once checked by hand, so don't trust it.
  const submitted: any = await speakClient.generate(
    "/v1/speak/higgsfield",
    {
      input_image: InputImage.fromUrl(imageUrl),
      input_audio: InputAudio.fromUrl(audioUrl),
      prompt: stylePrompt,
      quality: SpeakVideoQuality.HIGH,
      duration: SpeakDuration.SHORT,
    },
    { withPolling: false }
  );
  console.log("[speak] submitted:", submitted.id);

  const MAX_CHECKS = 90; // 90 * 10s = 15 minutes
  let final: any;
  for (let i = 0; i < MAX_CHECKS; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const res = await fetch(`https://api.higgsfield.ai/v1/job-sets/${submitted.id}`, {
      headers: { "hf-api-key": hfApiKey, "hf-secret": hfApiSecret },
    });
    final = await res.json();
    const statuses = (final.jobs ?? []).map((j: any) => j.status);
    console.log(`[speak] check ${i + 1}: ${statuses.join(",")}`);
    if (statuses.every((s: string) => ["completed", "failed", "nsfw", "canceled"].includes(s))) break;
  }
  console.log("[speak] final:", JSON.stringify(final));

  const job = final.jobs?.[0];
  if (!job || job.status !== "completed") {
    throw new Error(`[speak] non-completed status: ${job?.status} -- full response: ${JSON.stringify(final)}`);
  }

  const videoUrl = job.results?.raw?.url;
  if (!videoUrl) throw new Error(`[speak] could not find a video URL in: ${JSON.stringify(final)}`);
  return videoUrl;
}

async function main() {
  const arg = process.argv[2];

  if (!arg || arg === "list") {
    PROMPTS.forEach((p: any, i: number) => {
      console.log(`${i + 1}. [${p.tier}/${p.category}] ${p.feature} -- "${p.hook.slice(0, 60)}..."`);
    });
    console.log("\nRun: node generate-ugc-video.ts <number>");
    return;
  }

  const index = parseInt(arg, 10) - 1;
  const promptObj = PROMPTS[index];
  if (!promptObj) {
    console.error(`No prompt at position ${arg}. Run with "list" to see valid numbers (1-${PROMPTS.length}).`);
    process.exit(1);
  }
  console.log(`Generating video for prompt ${arg}: "${promptObj.feature}"`);

  // Resume a run that failed at step 4 without paying for steps 1-3 again:
  //   node generate-ugc-video.ts <n> --image <avatarUrl> --audio <audioUrl>
  const flag = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  let imageUrl = flag("--image");
  let audioUrl = flag("--audio");
  if (imageUrl || audioUrl) {
    if (!imageUrl || !audioUrl) throw new Error("Resuming needs both --image and --audio");
    console.log("Resuming at step 4 with the given image and audio");
  } else {
    console.log("\n--- Step 1/4: avatar image (Higgsfield Marketing Studio / Soul) ---");
    imageUrl = await generateAvatarImage(promptObj);
    console.log("Avatar image:", imageUrl);

    console.log("\n--- Step 2/4: voice audio (ElevenLabs) ---");
    const audioBuffer = await generateVoiceAudio(promptObj, Number(arg));

    console.log("\n--- Step 3/4: hosting audio (S3) ---");
    audioUrl = await uploadBufferToS3(audioBuffer, "marketing-automation/audio", "voice", "audio/wav", "wav");
    console.log("Audio URL:", audioUrl);
  }

  console.log("\n--- Step 4/4: talking video (Higgsfield Speak) ---");
  imageUrl = await ensureSpeakSizedImage(imageUrl);
  const videoUrl = await generateTalkingVideo(imageUrl, audioUrl, promptObj);
  console.log("\nDone. Video URL:", videoUrl);

  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  const logPath = path.join(outDir, `prompt-${arg}-${Date.now()}.json`);
  fs.writeFileSync(
    logPath,
    JSON.stringify({ promptNumber: Number(arg), feature: promptObj.feature, imageUrl, audioUrl, videoUrl, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log("Logged run to", logPath);
}

main().catch((e) => {
  console.error("\nFailed:", e.message ?? e);
  process.exit(1);
});
