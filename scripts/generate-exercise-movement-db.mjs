#!/usr/bin/env node
/**
 * One-off: downloads the free-exercise-db (public domain, Unlicense —
 * https://github.com/yuhonas/free-exercise-db), trims each entry down to
 * {id, name, images}, and saves it as a small static asset bundled with the
 * app. Not a runtime dependency on GitHub beyond fetching the two per-
 * exercise JPGs at display time (same as any remote image).
 *
 * Usage:
 *   node scripts/generate-exercise-movement-db.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../frontend/assets/exercise-movements.json");
const SOURCE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

console.log(`Fetching ${SOURCE_URL} ...`);
const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`Failed to fetch source dataset (${res.status})`);
  process.exit(1);
}
const exercises = await res.json();

const trimmed = exercises
  .filter((e) => Array.isArray(e.images) && e.images.length >= 2)
  .map((e) => ({ id: e.id, name: e.name, images: [e.images[0], e.images[1]] }));

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(trimmed));
console.log(`Saved ${trimmed.length} exercises to ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB)`);
