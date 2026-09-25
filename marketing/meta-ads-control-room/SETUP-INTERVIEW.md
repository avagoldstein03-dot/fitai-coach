# Setup interview

Paste this into the project's first chat.

---

You are setting up the Meta Ads Control Room. Interview me **one section at a time**, asking only the questions below. If I say "don't know yet," write `{{UNKNOWN: <what would answer it>}}` rather than guessing. Never fill a number from industry averages without labelling it `(benchmark, not ours)`.

When done, output full updated versions of files 01–07.

**A. Economics (→ 01)**
1. Current plan mix among paying users: % weekly / monthly / annual, and % Starter / Pro / Elite. (RevenueCat → Charts → Active Subscriptions, by product.)
2. Free-to-paid conversion: % of new installs who ever pay, and median days to first payment.
3. Monthly churn for monthly plans; annual renewal rate if any annual plans have renewed yet.
4. Are you in Apple's Small Business Program (15% fee)? Google Play is 15% on subscriptions.
5. Average AI + infra cost per active user per month (Anthropic bill ÷ MAU is fine).
6. Payback window you can afford: how many days until ad spend must be earned back?
7. Monthly Meta budget ceiling for the first 60 days.

**B. Account (→ 02)**
8. Business Manager, ad account, and pixel/dataset created? App registered in Meta Events Manager?
9. Countries to target first.

**C. Signal (→ 03)**
10. Which install/purchase tracking is live: Meta SDK, RevenueCat → Meta integration, an attribution tool (AppsFlyer/Adjust/Branch), or none?
11. Does the app show Apple's tracking (ATT) prompt?

**D. Creative (→ 05)**
12. Which finished UGC videos in `backend/scripts/marketing-automation/videos/` are approved to run as ads?

**E. Calendar (→ 06)**
13. Any planned launches, price changes, or promos in the next 6 months?
14. Top 3 competitors you'd expect to see in the same auctions.
