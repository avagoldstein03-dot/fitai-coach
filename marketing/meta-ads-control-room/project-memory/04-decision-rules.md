# 04: Decision rules

Starting rules are common practice for small app accounts, **not tested on our account yet**. Revise them after the first 60 days, and log each change at the bottom.

`TARGET_CPI` = break-even cost per install and `TARGET_CPA` = target CPA per payer, both from 01.

## Minimum data before any verdict
| Level | Min spend | Min events | Min time |
|-------|-----------|-----------|----------|
| Single ad (creative test) | 3 × TARGET_CPI | 20 installs | 3 days |
| Ad set (install-optimized) | 2 × TARGET_CPA | 50 installs | 7 days |
| Purchase verdict | 3 × TARGET_CPA | 10 payers **(RevenueCat-confirmed)** | 7 days + `{{DAYS_TO_PAY}}` |

Below all of these → **NEED DATA**.

## Kill
- Ad: min data met and CPI > 1.5 × TARGET_CPI → kill, log in 02 graveyard.
- Ad: thumb-stop rate (3-s views ÷ impressions) in the bottom third of our own ads after 1,000 impressions → kill early. The hook failed; fix it with `hook-generator`.
- Ad set: purchase min data met and CPA > 1.3 × TARGET_CPA → kill.

## Scale
- CPA ≤ 0.8 × TARGET_CPA for 7 consecutive days on RevenueCat-confirmed payers → raise budget.
- **Max budget change per step: +20%**, then wait 3 days.
- Never scale on install metrics alone.

## Hold / learning phase
- Meta's learning phase needs ~50 optimization events in 7 days. Don't edit budget, targeting, or creative in an ad set that's still learning unless it's clearly broken (spend with zero results after 2 × TARGET_CPI).
- If the budget can't produce ~50 purchase events a week, optimize for install (or trial) instead, and judge on purchases separately using RevenueCat.

## Thin data but metrics moving
- Big swing on fewer than the minimum events → HOLD and note it. Don't react.
- Consistent direction for 3+ days and ≥ half the minimum events → you may cut spend 20% (never raise it).

## Budget guardrails
- Never exceed `{{BUDGET_CEILING}}` / month.
- At least 70% of spend on proven ads and at most 30% on new creative tests, once there is a proven ad. Before that, 100% testing.

## Rule change log
| Date | Rule | Old → New | Why |
|------|------|-----------|-----|
