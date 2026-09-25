# 03: Signal truth

What Meta actually sees versus what it claims.

## Current state (checked in `frontend/package.json`, 2026-09-25)

| Component | Status |
|-----------|--------|
| Meta SDK (`react-native-fbsdk-next`) | **Not installed** |
| Attribution tool (AppsFlyer / Adjust / Branch / Singular) | **Not installed** |
| RevenueCat → Meta integration | `{{UNKNOWN: check RevenueCat dashboard → Integrations}}` |
| Apple tracking prompt (ATT) | **Not implemented** (no `expo-tracking-transparency`) |
| Product analytics | PostHog (`posthog-react-native`) |
| Billing truth | RevenueCat |

### ⚠ Launch blocker
**Right now Meta would receive no install or purchase events from the app.** It could only optimize for clicks, the worst signal for an app. Before spending, pick one:

- **A. RevenueCat → Meta integration (recommended first step).** Server-side purchase, trial, and renewal events sent to Meta. No new SDK, and purchase data comes from billing truth. Install events still need B or C.
- **B. Meta SDK in the app.** Adds install and app-open events; needs an EAS build (native module). On iOS, full install attribution needs the ATT prompt.
- **C. An attribution tool.** The most complete option, but paid and more setup. Probably overkill at launch budget.

Decide, then record it here. Plan: A + B. Step-by-step order is in `marketing/LAUNCH-CHECKLIST.md` (blocked until the business entity and bank account exist, which Meta's business verification needs).

## Events Meta should get (once wired)
| Event | Source | Use |
|-------|--------|-----|
| `fb_mobile_activate_app` / install | SDK or attribution tool | Early optimization while volume is low |
| `StartTrial` (if a trial is offered) | RevenueCat | Mid-funnel optimization |
| `Purchase` / `Subscribe` | RevenueCat | The event that matters |

## Known measurement gaps (apply these whenever reading Meta numbers)
- **iOS without ATT consent:** Meta gets aggregated, delayed, modeled data (SKAdNetwork / AdAttributionKit). iOS numbers in Ads Manager are partly estimates.
- **Freemium lag:** paying can happen days or weeks after install (`{{DAYS_TO_PAY}}` in 01). A 7-day click window misses late payers, so recent days always look worse than they'll end up.
- **Meta over-reporting:** Meta tends to claim credit for users who would have come anyway. Once there's data, compare Meta-reported purchases with RevenueCat new payers over the same period and record the ratio: `Meta over-reports by {{X}}×`. Until then, treat Meta purchase counts as an upper bound.
- **Organic halo:** UGC also posted organically inflates "paid" results. Note organic posting dates in 05.

## Attribution window
`{{ATTRIBUTION_WINDOW: default 7-day click / 1-day view}}`
