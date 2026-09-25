---
name: hook-generator
description: Generate scroll-stopping opening hooks (first 1–3 seconds) for Active AI short-form videos and carousels, per feature and audience segment. Use when the user asks for hooks, openers, first lines, or "ways to start" a video or post.
---

# Hook generator

Before writing, read `.claude/skills/content-agent/SKILL.md` (brand voice, audience segments, shipped differentiators, proven hook triggers). Every rule there applies here.

## Inputs (ask only for what's missing)
- **Feature**: must be a real shipped feature from content-agent's list.
- **Segment**: `genz`, `y2030` (20s–30s), `parent`, `plus45`, `glp1`, `lifestage` (perimenopause/menopause). Same IDs as `backend/scripts/marketing-automation/prompts.json`.
- **Format**: talking-head video, vlog, or carousel cover. Default: talking-head.
- **Count**: default 12.

## Process
1. Read `prompts.json` and collect the existing `hook` values for that feature/segment so you don't repeat them.
2. Write hooks spread evenly across the four triggers (Fear, Status, Curiosity, Identity). Label each one.
3. Keep each hook **≤12 spoken words** (~5 s at 125 wpm) and use the words a real person would say. Lowercase is fine.
4. For each hook, add a one-line **on-screen text** version (≤7 words). It should complement the spoken line, not repeat it.

## Output
A table: `# | trigger | spoken hook | on-screen text | why it works (≤10 words)`. Then pick your **top 3** and say why.

## Self-check before returning (drop any hook that fails)
- [ ] No invented stat, rating, user count, or quote
- [ ] Only features that have actually shipped
- [ ] No GLP-1/peptide brand or compound names
- [ ] Not a duplicate of an existing `prompts.json` hook
- [ ] Doesn't promise a screen or result the video can't show
