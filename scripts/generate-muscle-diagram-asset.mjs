#!/usr/bin/env node
/**
 * One-off asset generation: creates the front+back reference figure PNG used
 * as the base layer under frontend/components/MuscleDiagramSVG.tsx's colored
 * muscle-highlight overlay. Not a runtime endpoint — run once, commit the
 * resulting PNG, done.
 *
 * Usage:
 *   node scripts/generate-muscle-diagram-asset.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../frontend/assets/muscle-diagram.png");

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

const PROMPT = `A clean fitness-app muscle-map graphic. Two identical smooth, featureless human mannequin figures (like a tailor's dress form or 3D-print avatar — no face, no anatomical or gender detail, no clothing seams, just a smooth continuous body silhouette) standing in a relaxed A-pose with arms held slightly away from the sides, full body visible from head to feet. Positioned side by side with even spacing on a plain flat light gray background. The left figure is shown from the front, the right figure is shown from the back. Simple, soft, minimal flat-illustration style, muted neutral gray-blue color, no text or labels anywhere, centered symmetrical composition with generous even margins around both figures.`;

console.log("Requesting image from OpenAI (dall-e-3, 1792x1024)...");

const genRes = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-image-1",
    prompt: PROMPT,
    size: "1536x1024",
    quality: "medium",
    n: 1,
  }),
});

if (!genRes.ok) {
  const errText = await genRes.text();
  console.error(`OpenAI image generation failed (${genRes.status}):`, errText);
  process.exit(1);
}

const genData = await genRes.json();
const result = genData.data?.[0];
if (!result) {
  console.error("No image in response:", JSON.stringify(genData, null, 2));
  process.exit(1);
}

let buffer;
if (result.b64_json) {
  buffer = Buffer.from(result.b64_json, "base64");
} else if (result.url) {
  console.log("Downloading generated image...");
  const imgRes = await fetch(result.url);
  if (!imgRes.ok) {
    console.error(`Failed to download image (${imgRes.status})`);
    process.exit(1);
  }
  buffer = Buffer.from(await imgRes.arrayBuffer());
} else {
  console.error("Response had neither b64_json nor url:", JSON.stringify(genData, null, 2));
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, buffer);
console.log(`Saved to ${OUT_PATH} (${(buffer.length / 1024).toFixed(0)} KB)`);
