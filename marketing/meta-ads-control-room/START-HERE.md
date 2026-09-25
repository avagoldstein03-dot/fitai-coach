# Meta Ads Control Room: Active AI

A Claude Project that answers Meta ads questions using **our** numbers, history, and rules instead of generic advice. Adapted from apurv_sngh's 8-layer structure, rebuilt for a freemium subscription app rather than e-commerce.

## Status
**Pre-launch.** No Meta spend yet. Every `{{PLACEHOLDER}}` gets filled by `SETUP-INTERVIEW.md` or by the first 2–4 weeks of real spend. Until then the project should answer planning questions and refuse performance verdicts (see 00).

## How to install (claude.ai)
1. Create a Project named **Meta Ads Control Room**.
2. Paste `project-memory/00-behaviour-contract.md` into the project's **custom instructions** box.
3. Upload `01`–`07` as **project knowledge**.
4. First chat: "Run the setup interview," then paste `SETUP-INTERVIEW.md`. Claude asks the questions and returns updated versions of 01–07; re-upload them.

## Files

| # | File | What it holds | Lives in |
|---|------|---------------|----------|
| 00 | behaviour-contract | How it answers, refusal rules, brand rules | Custom instructions |
| 01 | economics | Prices, store fees, AI cost, churn → break-even CPA | Knowledge |
| 02 | account-map-and-graveyard | Campaign structure + everything tested and killed | Knowledge |
| 03 | signal-truth | Which events Meta actually receives, known gaps | Knowledge |
| 04 | decision-rules | Kill / scale / wait thresholds | Knowledge |
| 05 | creative-library | Every ad: hook, format, segment, result | Knowledge |
| 06 | market-and-calendar | Fitness seasonality, benchmarks, competitors | Knowledge |
| 07 | live-layer | What must be pulled fresh vs. trusted from files | Knowledge |

## Maintenance
- **Weekly:** update 05 (results) and 02 (anything killed) → re-upload.
- **Monthly:** refresh 01 from RevenueCat (churn, conversion, plan mix).
- These files are the source of truth; the claude.ai copies are uploads of them. Edit here, then re-upload.
