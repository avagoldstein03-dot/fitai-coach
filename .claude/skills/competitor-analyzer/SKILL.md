---
name: competitor-analyzer
description: Research a competing fitness or nutrition app's positioning, pricing, ads, and social hooks from public sources, and find openings where Active AI's real differentiators win. Use when the user names a competitor, asks what competitors are doing, or wants competitive positioning or ad inspiration.
---

# Competitor analyzer

Read first: `.claude/skills/content-agent/SKILL.md` (Active AI's real differentiators and rules).

## Inputs
Competitor name(s). If none are given, check `marketing/competitors/` for existing files and ask which to refresh or add.

## Research (public sources only, no logins)
Use web search and fetch. For each competitor collect:
1. **Positioning:** App Store and Google Play listing (title, subtitle, first screenshot captions), and the homepage headline.
2. **Pricing:** plans and prices as listed. Note the date and region seen.
3. **Paid ads:** Meta Ad Library (facebook.com/ads/library, filter by advertiser) and TikTok Creative Center top ads, if they appear. Record hooks, formats, and how long ads have been running (long-running ads are likely profitable). No Meta ad account is needed to browse the library.
4. **Organic:** their TikTok / Instagram / YouTube profiles: most-viewed recent posts and their hooks.
5. **Reviews:** recurring complaints in recent 1–3 star App Store / Play reviews. These are the openings.

Every fact gets a source URL and the date checked. If something can't be found, say so; never fill the gap from memory.

## Output
Save to `marketing/competitors/<competitor-slug>.md`:
- Snapshot table: positioning line, prices, platforms, free tier (y/n), ads (y/n)
- Their top 5 hooks (verbatim, with source)
- Top review complaints (paraphrased, with rough frequency, e.g. "~6 of 20 recent 1-star reviews")
- **Openings for Active AI:** each one maps a complaint or gap to a real shipped Active AI feature. Skip a gap if Active AI has no real answer to it.
- Sources + date

Then update the competitor section of `marketing/meta-ads-control-room/project-memory/06-market-and-calendar.md` with a one-line summary per competitor.

## Rules
- Comparative claims used later in content must be true on the day they're published. Re-check prices and features before a comparison post or ad goes out, and never name a competitor in a paid ad without that check.
- Hooks are for inspiration. Rewrite them for Active AI; don't copy scripts word for word.
