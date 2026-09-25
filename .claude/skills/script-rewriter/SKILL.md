---
name: script-rewriter
description: Rewrite a rough or underperforming Active AI video script into brand voice with re-hooks placed for retention and exact timing, output in the same shape as the UGC prompts.json entries. Use when the user pastes a script to tighten, asks to "rewrite," "punch up," or "fix the pacing" of a script, or wants a prompts.json entry reworked.
---

# Script rewriter

Before writing, read:
- `.claude/skills/content-agent/SKILL.md`: voice and rules
- `.claude/skills/content-agent/references/rehooks.md`: the re-hook library and placement rules

## Inputs
- A script (pasted, or a `prompts.json` entry by index/feature)
- Target length in seconds (default: keep the original length ±10%)
- Segment + feature, if not obvious from the script

## Process
1. **Diagnose first** (3–5 bullets): where attention likely drops, any brand-rule violations, any claim that isn't backed by a real feature or source.
2. **Rewrite**:
   - Hook in the first ≤12 words.
   - Place re-hooks using the library's density rules: a pattern interrupt every 3–5 s, a spoken re-hook every ~8–12 s. Tag each inline as `[RH#n]` (library number) so the edit can be checked.
   - Every tease gets paid off. Every "look at this" points to a real screenshot from `screenshot-assets/`.
   - End with a call-back (#29) or open question (#30) before the CTA.
3. **Time it.** Target **125 wpm** (matches the existing pipeline). Runtime = word count ÷ 125 × 60 s. State the word count and resulting runtime; trim until it's inside the target.

## Output
1. Diagnosis bullets
2. Rewritten script with `[RH#n]` tags
3. A JSON block with the `prompts.json` fields you changed (`hook`, `script` without tags, `onscreen`, `cta`, and the word-count/runtime sentence for `pacing`), ready to paste into the entry

Don't modify `prompts.json` yourself unless the user asks.

## Self-check
- [ ] Word count ÷ 125 matches the stated runtime
- [ ] No invented stats/testimonials; only shipped features; no drug brand names
- [ ] Every `[RH]` tease has a payoff in the script
- [ ] Every screen reference names a real screenshot asset
