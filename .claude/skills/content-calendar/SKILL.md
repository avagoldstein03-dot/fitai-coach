---
name: content-calendar
description: Plan and maintain Active AI's social content calendar (TikTok, Instagram, YouTube Shorts): fill the next 1–2 weeks with balanced topics, track each post from idea to logged, and show what needs doing today. Use when the user asks to plan content, fill the calendar, "what am I posting this week," or update a post's status.
---

# Content calendar

Calendar: `marketing/content-calendar/calendar.csv`. Notion isn't connected; if the user connects it later, mirror this file there rather than replacing it.

## Statuses
`idea` → `scripted` (entry exists in prompts.json or carousel text is written) → `rendered` (video or slides done) → `scheduled` → `posted` → `logged` (row added to `marketing/content-performance/posts.csv`)

## Plan mode ("plan next week")
1. Read the calendar, `posts.csv` (what's worked), and `prompts.json` (what's already scripted but not yet posted; `prompt_no` not yet in `posts.csv`).
2. Default cadence unless the user has set another: **5 videos/week, each cross-posted to TikTok + Instagram Reels + YouTube Shorts, plus 1 Instagram carousel.** Record the user's chosen cadence here once they pick one.
3. Balance across the week:
   - No segment more than twice a week; rotate all six over two weeks
   - Mix hook triggers (Fear / Status / Curiosity / Identity)
   - At least 1 slot per week uses an already-scripted but unposted prompt (e.g. demos #47–53) before new topics are added
   - Weight toward what `weekly-report` found works once there's ≥3 weeks of data
   - Seasonality from `marketing/meta-ads-control-room/project-memory/06-market-and-calendar.md`
4. New topics come from `topic-generator` rules. Show the proposed week as a table and write it only after the user confirms.
5. `keyword_cta`: only if `marketing/dm-funnel/README.md` says the funnel is live; otherwise blank.

## Today mode ("what's today")
List today's slot(s) and anything behind schedule (e.g. a `scripted` post dated within 2 days that isn't `rendered`). Give the exact next action: the render command `node generate-ugc-video.ts <n>`, "write captions" (→ `caption-writer`), or "log results" (→ `weekly-report` ingest).

## Update mode
Change a row's status or date when the user reports progress. When something is `posted`, remind them to log results 48h+ later.
