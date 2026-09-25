---
name: topic-generator
description: Generate new Active AI content topics by finding gaps in existing coverage across audience segments, features, and formats. Use when the user asks what to post, for content ideas, topics, a content backlog, or "what haven't we covered."
---

# Topic generator

Before writing, read `.claude/skills/content-agent/SKILL.md`.

## Process
1. **Measure coverage.** Read `backend/scripts/marketing-automation/prompts.json` and count entries by `tier` (segment) × `feature`. Show the user a compact coverage grid and name the thinnest cells.
2. **Generate topics** that fill the gaps. Each topic is one real shipped feature × one segment × one format:
   - `talking-head`, `vlog`, `carousel`, or `reply-to-comment` (only with a real comment the user supplies)
3. For each topic give: working title, segment, feature, format, hook trigger (Fear/Status/Curiosity/Identity), and one line on why this segment cares.

## Output
Coverage grid, then a numbered list of 10–15 topics (default), ranked with gap-fillers first.
