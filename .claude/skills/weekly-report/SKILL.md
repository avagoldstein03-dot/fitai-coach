---
name: weekly-report
description: Produce the weekly social content performance report for Active AI across TikTok, Instagram, and YouTube Shorts from the content performance log, with week-over-week changes, winners, losers, patterns, and next week's actions. Use when the user asks for the weekly report, "how did we do this week," or pastes platform analytics exports.
---

# Weekly progress report

Data lives in `marketing/content-performance/posts.csv` (column definitions in that folder's README).

## Step 1: Ingest (if the user pasted exports)
Map the export's columns onto the log's columns, show the new rows in a table for confirmation, then append them to `posts.csv`. Never invent a value: leave it blank if the export doesn't have it. Ask for `segment` / `feature` / `hook_trigger` if they can't be inferred from `prompt_no` (look it up in `backend/scripts/marketing-automation/prompts.json`) or the hook.

## Step 2: Report (this week = last 7 days of `date`, compared with the 7 before)

1. **Headline:** 2 sentences. What moved and the single most important thing to do next week.
2. **Scoreboard per platform:** posts, total views, median views per post, median % watched, follows, link clicks, each with a week-over-week change. Use medians, not averages; one viral post skews averages.
3. **Top 3 / bottom 3 posts** (by views, relative to that platform's median), with hook and format.
4. **Patterns:** only claim a pattern with ≥3 posts behind it on each side. Otherwise say "not enough posts yet to tell." Cut by `segment`, `feature`, `format`, `hook_trigger`, and `length_s` bucket (<20 s / 20–40 s / 40 s+).
5. **Next week:** exactly 3 actions, each tied to a finding above:
   - more of a winner (suggest specific topics via `topic-generator`)
   - fix a pattern (via `flop-analyzer` or `script-rewriter`)
   - one experiment (a new hook trigger, format, or segment)

## Rules
- Every number comes from the log. No estimates, no industry benchmarks presented as ours.
- Fewer than 3 posts on a platform this week → report the numbers but skip patterns for it.
- Don't equate views with business results. If the user supplies app installs or signups (PostHog / App Store Connect / RevenueCat), add them as a separate section and don't attribute them to specific posts unless there's a tracked link.
