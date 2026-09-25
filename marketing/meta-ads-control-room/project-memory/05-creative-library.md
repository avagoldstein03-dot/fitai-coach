# 05: Creative library

Every ad that has run or could run. Winners **and** losers. The losers teach as much.

Source of scripts: `backend/scripts/marketing-automation/prompts.json`. Finished videos: `backend/scripts/marketing-automation/videos/`. The video filename number = the prompts.json entry number (1-based).

## ⚠ Before any of these run as paid ads
The videos below are **AI-generated people speaking in first person** ("I downloaded it…", "my scale has been lying to me"). As organic content that's already a grey area; as **paid ads** they're testimonials from people who don't exist. The FTC's 2024 fake reviews and testimonials rule covers AI-generated ones, and they break our own no-fabricated-testimonials rule. Options:
1. **Recut as non-testimonial:** same avatar and visuals, script changed to feature demo / explainer ("here's what the readiness score actually looks at"). `script-rewriter` can do this.
2. **Real creators** (Phase 4 outreach) record testimonial-style versions about their own real use.
3. Keep the originals organic-only, with the platform's AI-content label on.

Also: #18 (GLP-1) implies the viewer's health condition. Meta's personal-attributes and health policies make it likely to be rejected or restricted as an ad. Use it organic-only, or rewrite it without "you're on a GLP-1" framing.

## Inventory

| # | Video | Segment | Feature | Hook type | Words / ~sec @125wpm | Paid-ready? | Status |
|---|-------|---------|---------|-----------|------|-------------|--------|
| 01 | Readiness-Score (+ HIGHQ) | genz | Readiness Score | Curiosity | 111 / 53s | No: testimonial | Not run |
| 11 | Value-Price-Framing | parent | Value / Price | Fear | 64 / 31s | No: testimonial | Not run |
| 17 | Body-Scan | genz | Body Scan | Fear | 73 / 35s | No: testimonial | Not run |
| 18 | GLP1-Muscle-Preservation | glp1 | GLP-1 Muscle Preservation | Identity | 91 / 44s | No: testimonial + health policy | Not run |
| 24 | Injury-Aware-Programming | y2030 | Injury-Aware | Curiosity | 56 / 27s | No: testimonial | Not run |
| 33 | Ingredient-Safety | y2030 | Ingredient Safety | Curiosity | 67 / 32s | No: testimonial | Not run |
| 42 | Zero-Ads | parent | Zero Ads | Fear | 71 / 34s | No: testimonial | Not run |

### Demo rewrites (prompts.json #47–53, added 2026-09-25)
Non-testimonial versions of the above: same avatars and settings, but the presenter explains what the feature does and never claims personal results. Each entry has `sourcePrompt`, `paidAdEligible`, and `disclosure` fields. **Not rendered yet.** Run `node generate-ugc-video.ts <n>`.

| # | From | Segment | Feature | Words / ~sec | Paid-ready? |
|---|------|---------|---------|------|-------------|
| 47 | 01 | genz | Readiness Score | 98 / 47s | Yes, with AI label |
| 48 | 11 | parent | Value / Price | 78 / 37s | Yes, with AI label |
| 49 | 17 | genz | Body Scan | 84 / 40s | Yes, with AI label |
| 50 | 18 | glp1 | GLP-1 Protein Tracking | 84 / 40s | **No: organic only** |
| 51 | 24 | y2030 | Injury-Aware | 75 / 36s | Yes, with AI label |
| 52 | 33 | y2030 | Ingredient Safety | 61 / 29s | Yes, with AI label |
| 53 | 42 | parent | Zero Ads | 55 / 26s | Yes, with AI label |

Voices: the pipeline picks `ELEVENLABS_VOICE_ID_PROMPT_<n>`. To reuse an original's cloned voice, set e.g. `ELEVENLABS_VOICE_ID_PROMPT_47` to the same value as `_PROMPT_1`.

## Results log (fill as ads run)

| Ad name (02 convention) | Launch | Hook (first 3 s, verbatim) | Format | Length | Offer framing | Proof type | Talent (real / AI) | Spend | Impr. | Thumb-stop % | CPI | Payers (RC) | CPA | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Patterns (Claude updates after every 5 new results)
- *(none yet: no data)*
