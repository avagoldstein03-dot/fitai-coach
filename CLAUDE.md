# CLAUDE.md

Operational notes for working on this repo — conventions and gotchas established through real work, not a restatement of README.md (read that first for stack/setup/project structure).

## Repo layout gotcha

`frontend/` is the real, actively-developed Expo RN app (matches README's documented structure). **`mobile/` is a stale, abandoned early scaffold** — last touched 2026-07-05, untouched since, not mentioned in README's project structure at all. Never edit `mobile/`; if a task seems to call for it, it almost certainly means `frontend/`.

## Backend — Prisma / schema

- **Never add a Prisma `enum`.** Zero enums exist anywhere in `schema.prisma`, on purpose. Categorical fields are `String?` / `String[]` with an inline `//` comment documenting valid values, validated via Zod at the API boundary. Follow this even when a real enum would "normally" be the obvious choice.
- **`prisma migrate dev` fails in this shell** with `"Prisma Migrate has detected that the environment is non-interactive"` on any migration needing confirmation (e.g. adding a unique constraint) — the shell here is non-interactive and there's no flag to force through it. Fix: hand-write `migrations/<timestamp>_<name>/migration.sql` yourself (match Prisma's generated SQL style), then run `npx prisma migrate deploy` (doesn't prompt) to apply it, then `npx prisma generate`.
- Neon (the Postgres host) occasionally throws a transient `P1001: Can't reach database server` on the first query after idle time (serverless cold start). Retry once before treating it as a real connectivity problem.
- Check row counts before adding a unique constraint to an existing column on a non-empty table — if genuinely zero rows, it's safe; otherwise resolve real duplicates first.

## Backend — testing

- Env vars read at module top-level (e.g. `ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS || "").split(",")`) get baked in at first `require()`. A test that sets `process.env.X` in `beforeEach` but statically `import`ed the module at the top of the file is testing a stale value. Fix: `jest.isolateModules(() => { handler = require("./foo").default; })` inside `beforeEach`, after setting the env var.
- For new backend features touching the DB, verify once against the **real** database (not mocks): a temporary, unmocked test file that creates real rows via the real Prisma client, calls the real handler, asserts on real output, cleans up in `afterAll` — then delete the temp file once it's passed. Never leave it in the permanent suite.
- CLI scripts in `backend/scripts/` (`grant-comp.js`, `create-affiliate.js`, `generate-affiliate-onboarding-link.js`) intentionally use plain `require("@prisma/client")`, not the `@/` path alias — they run via plain `node` outside the Next.js build pipeline, so `@/` doesn't resolve there. No test files for these, by established convention (they're thin, manually-run admin CLIs).
- Standalone `*.test.ts` files routinely show IDE diagnostics like `Cannot find name 'jest'/'describe'/'expect'` — this is a harmless single-file language-server false positive, not a real error. Always verify with the actual `npx jest`/`npx tsc --noEmit` command; never trust an inline diagnostic on a test file in isolation. More generally, diagnostics shown immediately after an Edit are often **stale**, reflecting the file state *before* that edit landed — re-check with a real command before reacting to one.

## Frontend — Expo / React Native

- Platform-specific files (`foo.ios.ts` / `foo.android.ts`) resolve automatically at bundle time via Metro, but `tsc` needs `"moduleSuffixes": [".ios", ".android", ".native", ""]` in `tsconfig.json`'s `compilerOptions` to resolve them too (already added — don't remove it).
- HealthKit (iOS) and Health Connect (Android) are native modules — no Expo Go, EAS dev-client build required. `lib/health.ios.ts` / `lib/health.android.ts` share pure aggregation math via `lib/health-aggregation.ts`, the one part of either integration that's actually unit-testable (the native calls themselves aren't mockable).
- i18n: edit `frontend/locales/en.json` only, then run `node scripts/translate-missing.mjs` **from the repo root** (not `frontend/` or `backend/`) — needs `ANTHROPIC_API_KEY` in the environment, diffs each of the other 38 locale files against `en.json` and translates only what's missing. Validate `en.json`'s JSON syntax before running — a syntax error there silently breaks missing-key detection for every locale.
- Metro bundle sanity check: `npx expo export --platform ios` (and `--platform android` too, if the change touches Android-specific code) is a fast way to catch JS-level import/resolution errors without a device or emulator — not a substitute for a real native build when native modules are involved, but real signal for everything else.
- Retailer links (Amazon/Walmart) route through `frontend/lib/affiliate-links.ts` — never hardcode a retailer URL in a screen again; add the destination there so affiliate tagging stays centralized.

## Deploy workflow

- Backend has **no auto-deploy** from `git push` — after every push touching `backend/` (including migration-only changes), manually run `cd backend && npx vercel --prod`.
- That command occasionally fails with a transient `"Not authorized"` error. Fix: `npx vercel whoami` to confirm the session is still valid, then immediately retry — it typically succeeds on the second attempt.
- Frontend-only changes (no backend/schema touched) don't need a Vercel deploy — they ship via Metro/OTA or the next EAS build instead.

## Marketing artifacts

Two persistent Claude Artifacts get updated in place across sessions, not recreated:
- **Marketing & Launch Hub** (`active-ai-hub.html`) — UGC prompt library, growth plan, screenshots reference.
- **Market Intelligence Brief** (`market-intel.html`) — TAM/SAM/SOM, ranked industry problems, growth roadmap.

When updating either, republish via the `Artifact` tool passing the **existing URL** — a fresh publish without `url` mints a new link and orphans the old one.

Content rules for the UGC prompt library:
- Never let an AI video/image generator render actual app UI on a "phone screen" — always composite a **real** screenshot (from the hub's Screenshots tab) into the shot instead.
- Never depict or name a real unapproved/gray-market pharmaceutical or research-chemical product (e.g. specific GLP-1/peptide brand names) — use the generic category term.
- "Maximum specification": replace vague adjectives with exact numbers in generation prompts (phone distance in inches, camera angle in degrees, target duration derived from word-count ÷ wpm, max pause length in seconds).

## Product/business context

- Readiness score and the life-stage nutrition adjustment are **deliberately free/ungated** — headline differentiators, zero marginal AI cost since both are pure computation. Don't tier-gate either without confirming this reasoning still holds.
- Subscription tiers: Starter $9.99/mo, Pro $15.99/mo, Elite $19.99/mo.
- RevenueCat is the only real, **live** mobile billing path today. The legacy Stripe webhook (`backend/pages/api/webhooks/stripe.ts`) handles a web-checkout path that isn't in the active purchase flow — don't assume Stripe subscription events are primary.
