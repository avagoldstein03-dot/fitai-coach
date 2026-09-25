# 01: Economics

## Known facts (from the app code, `frontend/lib/currency.ts`, USD base)

| Tier | Weekly | Monthly | Annual |
|------|--------|---------|--------|
| Starter | $2.99 | $9.99 | $89.99 |
| Pro | $3.99 | $15.99 | $119.99 |
| Elite | $4.99 | $19.99 | $149.99 |

- Model: **freemium.** A free tier exists; readiness score and life-stage nutrition are free on purpose.
- Billing: **RevenueCat** (App Store + Google Play). Stripe web checkout is legacy, not in the active funnel.
- Referral: connecting a friend gives both users 7 days of Pro (a cost: 7 days of Pro-level AI usage per referral).
- Store fees: Google Play 15% on subscriptions. Apple 15% if enrolled in the Small Business Program, else 30% in year one. → `{{APPLE_FEE: 15% or 30%}}`

## Inputs to fill (setup interview section A)

| Input | Value | Source |
|-------|-------|--------|
| Plan mix (weekly / monthly / annual) | `{{PLAN_MIX}}` | RevenueCat |
| Tier mix (Starter / Pro / Elite) | `{{TIER_MIX}}` | RevenueCat |
| Install → paid conversion | `{{INSTALL_TO_PAID_%}}` | RevenueCat / PostHog |
| Median days install → first payment | `{{DAYS_TO_PAY}}` | RevenueCat |
| Monthly churn (monthly plans) | `{{MONTHLY_CHURN_%}}` | RevenueCat |
| AI + infra cost per active user / month | `{{COST_PER_MAU}}` | Anthropic + Vercel + Neon bills ÷ MAU |
| Payback window we can afford | `{{PAYBACK_DAYS}}` | Founder |
| Monthly Meta budget ceiling | `{{BUDGET_CEILING}}` | Founder |

## Formulas (Claude computes these once inputs exist)

1. **Blended net revenue per payer per month (ARPPU_net)** = Σ(plan-mix share × monthly-equivalent price) × (1 − store fee).
   Monthly equivalent: weekly × 4.33; annual ÷ 12.
2. **Monthly contribution per payer** = ARPPU_net − COST_PER_MAU.
3. **LTV (conservative)** = monthly contribution × min(1 ÷ MONTHLY_CHURN, 12). Capped at 12 months until real retention data exists.
4. **Break-even CPA per payer** = LTV. **Target CPA per payer** = contribution earned within PAYBACK_DAYS.
5. **Break-even cost per install** = target CPA per payer × INSTALL_TO_PAID.

These are the numbers every KILL/SCALE call in 04 is judged against.

## Worked example (ILLUSTRATIVE ONLY, not our data)
Monthly Pro only, 15% fee, $1.50 AI cost, 10% churn, 5% install→paid:
ARPPU_net = 15.99 × 0.85 = $13.59 → contribution $12.09 → LTV = 12.09 × 10 = $120.90 → break-even cost per install = $120.90 × 0.05 = **$6.05**.
Shows the shape of the math; replace every input before using it for decisions.
