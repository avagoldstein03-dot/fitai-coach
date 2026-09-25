---
name: topic-generator
description: Generate new Active AI content topics by finding gaps in existing coverage across audience segments, features, and formats. Use when the user asks what to post, for content ideas, topics, a content backlog, or "what haven't we covered."
---

# Topic generator

Before writing, read `.claude/skills/content-agent/SKILL.md`.

## Process
1. **Measure coverage.** Read `backend/scripts/marketing-automation/prompts.json` and count entries by `tier` (segment) × `feature`. Show the user a compact coverage grid and name the thinnest cells.
2. **Generate topics** that fill the gaps. Each topic is one real shipped feature × one segment × one format:
   - `talking-head`, `vlog`, `carousel`, `reply-to-comment` (only with a real comment the user supplies), or `prompts-carousel` (below)
3. For each topic give: working title, segment, feature, format, hook trigger (Fear/Status/Curiosity/Identity), and one line on why this segment cares.

## `prompts-carousel` format
Modeled on the "7 Claude prompts for…" carousels, but pointed at fitness. The slides are real prompts a viewer could type into the Active AI coach:
- Slide 1: hook title (e.g. "5 prompts for when you can't make yourself work out")
- Slides 2–N: one prompt per slide, a short name + the prompt in a chat-box style
- Last slide: CTA
Proven prompt angles: task-paralysis ("break my workout into steps under a minute"), dopamine menu (5-min movement "appetizers," full workouts as "mains," mobility as "sides"), time-blindness ("I think it takes 30 min, it takes 75, so what am I forgetting?"), brain dump (sort into Now/Later/Drop), context switch (a 3-min reset between work and a workout).
**Only include a prompt if the real coach handles it well.** Test it in the app first; the screenshot on each slide must be a real coach response.

## Output
Coverage grid, then a numbered list of 10–15 topics (default), ranked with gap-fillers first.
