---
name: caption-writer
description: Write platform-specific captions, titles, and hashtags for an Active AI video or carousel on TikTok, Instagram, and YouTube Shorts. Use when the user asks for a caption, hashtags, a title, or post copy for something they're about to publish.
---

# Caption & hashtag writer

Before writing, read `.claude/skills/content-agent/SKILL.md` (voice + rules) and `.claude/skills/content-agent/references/platforms.md` (per-platform specs and the comment-keyword CTA rules).

## Inputs
- The video's script or the carousel's slide text. If the user names a `prompts.json` entry (by index or feature), read its `script`, `onscreen`, and `cta` from `backend/scripts/marketing-automation/prompts.json`.
- Which platforms. Default: all three.

## Output: one block per platform
**TikTok**: caption (1–2 lines, keyword-first), 3–5 hashtags.
**Instagram**: first line (the hook, ≤125 chars so it shows before "more"), 1–3 short body lines, CTA, max 5 hashtags.
**YouTube Shorts**: title (≤60 chars, search phrasing like "how I…" / "app that…"), 1–2 line description, 1–3 hashtags.

Hashtag mix per platform: mostly niche/segment tags (e.g. `#perimenopausefitness`, `#glp1journey`), at most one broad tag (`#fitness`). Never a GLP-1/peptide brand-name tag.

## Self-check
- [ ] Caption matches what the video actually says and shows, with no new claims
- [ ] No invented stats, ratings, or testimonials
- [ ] Instagram ≤5 hashtags
- [ ] Comment-keyword CTA only if the user confirms the DM automation is live
