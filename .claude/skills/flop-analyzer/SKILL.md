---
name: flop-analyzer
description: Diagnose why an Active AI video or carousel underperformed and produce a concrete fix (new hook, re-hook placement, CTA, or format) by comparing it with the account's own winners. Use when the user says a post flopped, asks why a video didn't do well, or wants to fix an underperforming post.
---

# Flop video analyzer

Read first: `.claude/skills/content-agent/SKILL.md` and `.claude/skills/content-agent/references/rehooks.md`.

## Inputs
- The post: a row in `marketing/content-performance/posts.csv` (by URL, date, or hook), or pasted numbers
- The script: from `prompts.json` via `prompt_no`, or pasted
- **Best:** a screenshot of the platform's retention graph

## Step 1: Is it actually a flop?
Compare with the median for the **same platform** over the last 30 days in the log. It's a flop only if it's in the bottom quartile on views **or** % watched. If there are fewer than 8 posts on that platform, say the baseline is thin and compare anyway, but hedge.

## Step 2: Find which stage failed
| Symptom | Stage | Likely cause |
|---|---|---|
| Low views, and low watch time in the first 3 s (or a steep drop at 0–3 s on the graph) | **Hook** | First line or first frame didn't stop the scroll |
| Normal early views, then a steep drop mid-video | **Retention** | Gap with no re-hook, a slow section, or a tease with no payoff |
| Good watch %, but few follows / saves / link clicks | **Payoff / CTA** | Weak ending, vague CTA, no reason to act |
| Everything low, similar posts also low that week | **Distribution** | Posting time, platform-wide dip, or an AI-label or content-policy limit. Check `notes` before blaming the script. |

Map any drop-off timestamp onto the script: at ~125 wpm, second *t* ≈ word *t × 2.08*. Quote the exact words spoken there.

## Step 3: Compare with winners
Pull the 3 best posts on the same platform with the same `segment` or `feature`. Name the concrete differences (hook trigger, first-3-s wording, length, where the first re-hook lands, CTA). No difference with at least 2 winners behind it counts as a finding.

## Step 4: Fix
- **Hook stage:** 3 replacement hooks (use `hook-generator` rules).
- **Retention stage:** the rewritten section with `[RH#n]` re-hooks from the library at the drop point.
- **CTA stage:** 2 alternative endings.
- **Distribution stage:** no script change; say what to try instead (repost time, format).

End with a one-line verdict: **Repost with fix** (same video, new hook or caption), **Re-render** (new script through `script-rewriter`, then the pipeline), or **Let it go** (a topic that has lost ≥3 times → add to the graveyard section of `marketing/meta-ads-control-room/project-memory/02-account-map-and-graveyard.md` so ads don't repeat it).

## Rules
- A single post is weak evidence. Say how confident you are (high / medium / low) and why.
- Never blame the audience or "the algorithm" without evidence from the log.
- Fixes follow all brand rules: no invented stats or testimonials, real screenshots only.
