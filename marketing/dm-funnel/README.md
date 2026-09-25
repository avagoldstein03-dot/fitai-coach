# Comment-keyword → DM funnel

"Comment READY and I'll send you ___" → an automatic DM with the link. It turns comments (which boost reach) into link clicks (which the algorithm doesn't penalize, unlike links in captions).

**Status: not live.** Until it is, `caption-writer` won't use keyword CTAs (see `.claude/skills/content-agent/references/platforms.md`). When this goes live, update that file.

## Tool: ManyChat (Instagram first)
ManyChat is an official Meta messaging partner. It doesn't need the business entity, so you can set this up now.
1. Instagram account must be **Professional** (Creator or Business), with **Settings → Messages → Allow access to messages** turned on for connected tools.
2. Sign up at manychat.com with the Instagram account → connect.
3. For each keyword below: **Automation → New → "User comments on your post or reel"** → trigger on the keyword (any post, or specific posts) → action: send DM (and optionally a public auto-reply like "sent! check your DMs").
4. Test from a second account before announcing any keyword in a post.

Check ManyChat's current plan limits and pricing; the free plan has contact caps. TikTok comment-to-DM automation is much more limited, so start with Instagram, and on TikTok use "link in bio."

## Keywords (every destination must actually exist)

| Keyword | Use on posts about | DM copy (≤50 words, brand voice) | Link |
|---|---|---|---|
| READY | Readiness score | "here you go! Active AI's readiness score looks at your sleep, resting heart rate, and last workout, and it's free on every plan. download here 👉 {{APP_LINK}}" | `{{APP_LINK}}` |
| PROTEIN | Life-stage nutrition, GLP-1 protein, protein tracking | "here's the app: it tracks protein to the exact gram using Open Food Facts data, and adjusts targets for perimenopause/menopause if that's you. 👉 {{APP_LINK}}" | `{{APP_LINK}}` |
| SCAN | Food scanner, ingredient check | "here it is: scan a barcode and get the nutrition plus a flag on additives worth a second look. 3 free scans a day 👉 {{APP_LINK}}" | `{{APP_LINK}}` |
| COACH | Coach chat, prompts carousels | "here you go! the AI coach is in the free plan (5 messages a day). try one of the prompts from the post 👉 {{APP_LINK}}" | `{{APP_LINK}}` |

`{{APP_LINK}}`: one link that sends iPhones to the App Store and Android to Google Play. A free smart-link service or a simple page on the marketing site works. Add a UTM or `?src=ig_dm_<keyword>` so installs from DMs can be told apart later.

Free-tier facts above are from `backend/lib/subscription-middleware.ts` (free: 3 food scans/day, 5 coach messages/day, basic body scan). Re-check them if tier limits change.

## Rules
- One keyword per post, all caps, stated in the caption **and** on screen.
- Never promise something the DM doesn't deliver (no "free guide" unless a guide exists).
- The DM is the only automated message. No follow-up sequences until there's a real newsletter or lead magnet to send.
