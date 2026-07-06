#!/usr/bin/env node
/**
 * Translates en.json into all supported languages via the Claude Haiku API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-locales.mjs
 *
 * Skips languages that already have a locale file.
 * Pass --force to re-translate everything.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "../frontend/locales");
const EN_JSON = path.join(LOCALES_DIR, "en.json");
// Read .env from project root or backend folder
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
const FORCE = process.argv.includes("--force");
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

const enSource = fs.readFileSync(EN_JSON, "utf8");

async function translateLanguage({ name, code }) {
  const outPath = path.join(LOCALES_DIR, `${code}.json`);

  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`[skip] ${code} — already exists`);
    return;
  }

  console.log(`[translating] ${code} (${name})...`);

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
- Use natural, fitness-appropriate language (e.g. "macros", "TDEE", "body scan" should be translated naturally for the target language or kept as-is if they are commonly used as English terms in that language's fitness community).
- Return ONLY valid JSON with no markdown fences or explanation.

JSON to translate:
${enSource}`,
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

  // Extract JSON — find the outermost { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const raw = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[error] ${code} — model returned invalid JSON, skipping.`);
    console.error("  Raw output (first 300 chars):", raw.slice(0, 300));
    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
  console.log(`[done] ${code}`);
}

// Run sequentially to stay within rate limits
for (const lang of LANGUAGES.slice(0, LIMIT)) {
  try {
    await translateLanguage(lang);
  } catch (e) {
    console.error(`[error] ${lang.code}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}

// Rewrite i18n.ts with all available locale files registered
const allCodes = ["en", ...LANGUAGES.map((l) => l.code)].filter((c) =>
  fs.existsSync(path.join(LOCALES_DIR, `${c}.json`))
);
const allNames = {
  en: "English",
  ...Object.fromEntries(LANGUAGES.map((l) => [l.code, l.name])),
};

const imports = allCodes
  .map((c) => `import ${c.replace(/-/g, "_")} from "../locales/${c}.json";`)
  .join("\n");
const resourceEntries = allCodes
  .map((c) => `    "${c}": { translation: ${c.replace(/-/g, "_")} },`)
  .join("\n");
const languageCodeEntries = Object.entries(allNames)
  .map(([code, name]) => `  "${name}": "${code}",`)
  .join("\n");

const i18nTs = `import i18n from "i18next";
import { initReactI18next } from "react-i18next";
${imports}

export const LANGUAGE_CODES: Record<string, string> = {
${languageCodeEntries}
};

i18n.use(initReactI18next).init({
  resources: {
${resourceEntries}
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
`;

fs.writeFileSync(path.join(__dirname, "../frontend/lib/i18n.ts"), i18nTs, "utf8");
console.log(`\n[updated] frontend/lib/i18n.ts — registered ${allCodes.length} languages.`);
console.log("All done!");
