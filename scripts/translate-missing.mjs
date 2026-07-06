#!/usr/bin/env node
/**
 * Translates only keys missing from each locale file and merges them in.
 * Much faster than translate-locales.mjs --force when most keys already exist.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-missing.mjs
 *   node scripts/translate-missing.mjs --limit=5   # only first N languages
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "../frontend/locales");
const EN_JSON = path.join(LOCALES_DIR, "en.json");

for (const envPath of [path.join(__dirname, "../.env"), path.join(__dirname, "../backend/.env")]) {
  try {
    const envText = fs.readFileSync(envPath, "utf8");
    for (const line of envText.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] ??= rest.join("=").trim();
    }
  } catch {}
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

if (!API_KEY) {
  console.error("Set ANTHROPIC_API_KEY environment variable first.");
  process.exit(1);
}

const LANGUAGES = [
  { name: "Spanish",               code: "es"    },
  { name: "French",                code: "fr"    },
  { name: "German",                code: "de"    },
  { name: "Portuguese",            code: "pt"    },
  { name: "Italian",               code: "it"    },
  { name: "Dutch",                 code: "nl"    },
  { name: "Russian",               code: "ru"    },
  { name: "Polish",                code: "pl"    },
  { name: "Turkish",               code: "tr"    },
  { name: "Arabic",                code: "ar"    },
  { name: "Hebrew",                code: "he"    },
  { name: "Hindi",                 code: "hi"    },
  { name: "Bengali",               code: "bn"    },
  { name: "Urdu",                  code: "ur"    },
  { name: "Japanese",              code: "ja"    },
  { name: "Chinese (Simplified)",  code: "zh"    },
  { name: "Chinese (Traditional)", code: "zh-TW" },
  { name: "Korean",                code: "ko"    },
  { name: "Vietnamese",            code: "vi"    },
  { name: "Thai",                  code: "th"    },
  { name: "Indonesian",            code: "id"    },
  { name: "Malay",                 code: "ms"    },
  { name: "Tagalog",               code: "tl"    },
  { name: "Swahili",               code: "sw"    },
  { name: "Afrikaans",             code: "af"    },
  { name: "Greek",                 code: "el"    },
  { name: "Czech",                 code: "cs"    },
  { name: "Slovak",                code: "sk"    },
  { name: "Romanian",              code: "ro"    },
  { name: "Hungarian",             code: "hu"    },
  { name: "Swedish",               code: "sv"    },
  { name: "Norwegian",             code: "no"    },
  { name: "Danish",                code: "da"    },
  { name: "Finnish",               code: "fi"    },
  { name: "Ukrainian",             code: "uk"    },
  { name: "Croatian",              code: "hr"    },
  { name: "Serbian",               code: "sr"    },
  { name: "Bulgarian",             code: "bg"    },
];

function deepMerge(target, source) {
  const result = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof result[k] === "object" && !Array.isArray(result[k])) {
      result[k] = deepMerge(result[k] ?? {}, v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function getAllKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of getAllKeys(v, full)) keys.add(sub);
    } else {
      keys.add(full);
    }
  }
  return keys;
}

function pickMissingKeys(en, existing, prefix = "") {
  const result = {};
  for (const [k, v] of Object.entries(en)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sub = pickMissingKeys(v, existing[k] ?? {}, prefix ? `${prefix}.${k}` : k);
      if (Object.keys(sub).length > 0) result[k] = sub;
    } else if (existing[k] === undefined) {
      result[k] = v;
    }
  }
  return result;
}

const en = JSON.parse(fs.readFileSync(EN_JSON, "utf8"));

async function translateLanguage({ name, code }) {
  const outPath = path.join(LOCALES_DIR, `${code}.json`);
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  const missing = pickMissingKeys(en, existing);
  const missingKeyCount = getAllKeys(missing).size;

  if (missingKeyCount === 0) {
    console.log(`[skip] ${code} — already complete`);
    return;
  }

  console.log(`[translating] ${code} (${name}) — ${missingKeyCount} missing keys...`);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: `You are translating a fitness app's i18next JSON file from English to ${name}.

Rules:
- Keep ALL JSON keys exactly as-is (do not translate keys).
- Translate only the string values.
- Preserve interpolation placeholders exactly: {{variable}}, {{count}}, {{date}}, etc.
- Preserve emoji characters exactly as they appear.
- Preserve arrow/symbol characters (← → ✓ ✕) exactly.
- Preserve arrays — translate each string element, keep array structure.
- Use natural, fitness-appropriate language.
- Return ONLY valid JSON with no markdown fences or explanation.

JSON to translate:
${JSON.stringify(missing, null, 2)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const raw = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

  let translated;
  try {
    translated = JSON.parse(raw);
  } catch {
    console.error(`[error] ${code} — invalid JSON returned, skipping.`);
    console.error("  Raw (first 300 chars):", raw.slice(0, 300));
    return;
  }

  const merged = deepMerge(existing, translated);
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
  console.log(`[done] ${code} — merged ${missingKeyCount} keys`);
}

for (const lang of LANGUAGES.slice(0, LIMIT)) {
  try {
    await translateLanguage(lang);
  } catch (e) {
    console.error(`[error] ${lang.code}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
