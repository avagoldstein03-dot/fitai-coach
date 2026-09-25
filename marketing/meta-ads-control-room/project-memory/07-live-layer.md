# 07: Live layer

What Claude must **ask for fresh** each time versus trust from these files. Files go stale; these rules stop stale numbers from driving decisions.

## Always pull fresh (ask the user to paste or export; never reuse from a past chat)
- Spend, impressions, installs, CPI, CPA for the period being judged (Ads Manager export)
- New payers for the same period (**RevenueCat**, the source of truth for revenue)
- Which ad sets are currently in learning phase
- Current daily budgets

## Trust from files (refresh on their schedule)
| File | Refresh | If older than… |
|------|---------|----------------|
| 01 economics | Monthly | 45 days → warn that the verdicts may be off |
| 02 graveyard | On every kill | n/a |
| 03 signal | On any tracking change | n/a |
| 04 rules | When the change log updates | n/a |
| 05 creative | Weekly | 14 days → ask for latest results first |
| 06 calendar | Quarterly | n/a |

## What NOT to pull
- **Meta's "estimated" or "modeled" conversions as ground truth.** Use them for direction only (see 03).
- **Days inside the attribution lag** (the last `{{DAYS_TO_PAY}}` days) for purchase verdicts. They're incomplete.
- **Breakdowns with fewer than 04's minimum events** (by age, placement, hour). They're noise.
- **Other accounts' or courses' benchmarks** presented as ours.

## Freshness stamp
Every answer that uses live numbers states: `Data as of <date>, sources: <Ads Manager / RevenueCat>`.
