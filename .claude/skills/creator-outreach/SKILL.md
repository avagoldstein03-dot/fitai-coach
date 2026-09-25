---
name: creator-outreach
description: Manage Active AI's UGC creator pipeline: add creators to the tracker, draft personalized pitch emails or DMs (never send), show who needs a follow-up, and update statuses. Use when the user mentions creators, influencers, UGC outreach, pitch emails, partnerships, or asks who to follow up with.
---

# Creator outreach

Read first: `marketing/outreach/README.md` (offers, legal rules, statuses) and `.claude/skills/content-agent/SKILL.md` (voice).
Tracker: `marketing/outreach/creators.csv`.

## Modes (infer from the request)

### Add creators
The user pastes handles, links, or notes. Fill what's known; never invent follower counts, emails, or post details. Leave blanks and list what's missing. Set `status=found` and `date_found=today`. Flag anyone who doesn't fit README's criteria (and say why) instead of silently adding them.

### Draft pitches
For each `found` creator (or those the user names), write one email (or DM if no email):
- **Subject:** specific and honest, ≤8 words, no clickbait (e.g. "your perimenopause strength series + an app idea")
- **Line 1:** reference `personal_hook`, a real, specific post of theirs. If `personal_hook` is empty, stop and ask; a generic opener isn't allowed.
- **Line 2–3:** what Active AI is, in one sentence, plus the one real feature most relevant to their niche
- **Offer:** from README's "available now" list only. State plainly what's pending (e.g. commission payouts start once payouts go live)
- **Ask:** "try it for 2 weeks; if you genuinely like it, would you make a video about it?" No obligation to post, no scripted claims
- **Disclosure line:** "if you post, we'd ask you to use the paid-partnership label"
- **Opt-out:** "not your thing? just reply 'no' and I won't follow up"
- Sign-off with the user's name. ≤120 words total.

Show all drafts together, then set `status=drafted`. **Never send anything.** The user sends from their own inbox (≤20/day) and tells you, then set `status=sent` and `date_sent`.

### Follow-ups
List creators where `status=sent` and `date_sent` is ≥5 days ago with no `date_followup`. Draft one short follow-up each (≤50 words, new angle or a relevant demo video). After the user sends, set `followed_up`. Mark `no_response` 7 days after follow-up. Never draft a second follow-up.

### Onboard (after a yes)
Give the user the exact commands from README (grant-comp, create-affiliate) with the creator's email filled in. The user runs them; you don't touch the production database. Record `offer`, `affiliate_code`, `comp_until`. Then draft a short welcome message with: talking points (real features only), the disclosure requirement, the brand no-go list (no health outcome claims, no drug brand names, no before/after body shots), and their code.

### Status
Summarize the pipeline: count per status, who needs action today, and anyone `posted` whose content should be logged in `marketing/content-performance/posts.csv`.
