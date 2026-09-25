# Creator outreach

Finding real creators to make UGC and testimonial content about their **real** use of Active AI. This is the fix for the AI-avatar testimonial problem (see `meta-ads-control-room/project-memory/05-creative-library.md`). Run it through the `creator-outreach` skill.

## What we can offer (real, from the codebase)
| Offer | How | Available now? |
|---|---|---|
| Free Elite access | `cd backend && node scripts/grant-comp.js <email> elite <days>` | ✅ Yes |
| Affiliate code, 20–30% commission on referred users' payments | `node scripts/create-affiliate.js "<name>" <email> <rate>`; commissions recorded from RevenueCat automatically | ✅ Code + tracking now |
| Commission payouts | Stripe Connect onboarding (`generate-affiliate-onboarding-link.js`) | ⏳ After the business Stripe account exists (see `../LAUNCH-CHECKLIST.md`) |
| Flat fee per video | Pay from the business account | ⏳ After the business bank account exists |
| Partnership Ads (run their post as a Meta ad) | Meta Business Suite | ⏳ After Meta setup |

Until payouts work, pitch **free Elite + affiliate code, commissions paid out once payouts go live** and say that plainly. Don't imply cash you can't pay yet.

## Non-negotiables (FTC + brand rules)
- **Disclosure:** creators must disclose the relationship: platform "Paid partnership" label and/or #ad. **Free access counts as a material connection too**, not just cash.
- **Real use only:** they try the app before posting. We give talking points (features, facts) but never scripted results or claims they didn't experience.
- **No health claims** (weight loss amounts, medical outcomes), no GLP-1/peptide brand names, no before/after body shots in anything we might run as an ad.
- **Emails:** honest subject line, your real name, a one-line "not interested? just reply and I won't follow up" opt-out, and the business postal address once it exists. Send from your own inbox, ≤20/day, personalized. No bulk blasting.

## Pipeline statuses (`creators.csv`)
`found` → `drafted` → `sent` → `followed_up` → `replied` → `onboarded` (comp + code) → `posted` → `paid` | `declined` | `no_response`

Follow-up rule: one follow-up 5 days after `sent`, then mark `no_response` after 7 more days. Never more than one follow-up.

## Finding creators (what to look for)
- 2K–50K followers (micro creators: cheaper, more trusted, more likely to reply)
- Posts regularly in one of our segments: 45+ fitness, perimenopause/menopause, busy parents, GLP-1 journey, college/genz fitness, 20s–30s lifestyle
- Talking-head or vlog style (matches our proven formats)
- Comments look like real conversations, not bots
- Contact: email in bio preferred over DMs
