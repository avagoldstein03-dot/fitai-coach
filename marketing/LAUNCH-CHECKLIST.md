# Paid-ads launch checklist

Order matters: each step needs the ones before it. Status as of 2026-09-25: **blocked on step 1.**

## 1. Business foundation (you're here)
- [ ] Business entity formed (LLC or similar) + EIN
- [ ] Business bank account
- [ ] Business card for ad spend (keeps ad charges off personal accounts)
- [ ] Decide whether to move the Apple Developer / Google Play accounts from personal to the business. Both stores support converting or transferring to an organization account; it's easier before scaling.
- [ ] Apple **Small Business Program** enrollment → 15% instead of 30% (affects every number in `meta-ads-control-room/project-memory/01-economics.md`)

## 2. Meta accounts
- [ ] Meta **Business portfolio** (business.facebook.com) under the business name
- [ ] **Business verification** (needs the legal name, address, and documents from step 1; this is why the entity comes first)
- [ ] Ad account + payment method (the business card), with a spending limit
- [ ] Connect the Instagram account to the business portfolio
- [ ] Meta **developer app** (developers.facebook.com) with the iOS bundle ID and Android package name added → gives you the **App ID**
- [ ] In Events Manager, create a **dataset** for the app

## 3. Connect RevenueCat → Meta (purchase events)
Sends trial, purchase, and renewal events from RevenueCat's servers to Meta. No app update needed for this part.
- [ ] RevenueCat dashboard → your project → **Integrations** → **Meta Ads** (may be listed as Facebook)
- [ ] Enter what it asks for, typically the Meta App ID and a Conversions API access token / dataset ID from Events Manager. RevenueCat's Meta integration doc has the current field list; follow it over this note.
- [ ] Map events: at minimum initial purchase → `Purchase`/`Subscribe`, trial start → `StartTrial` (if you offer trials)
- [ ] Better matching (app update, do with step 4): call `Purchases.collectDeviceIdentifiers()` after RevenueCat is configured, and pass Meta's anonymous ID to RevenueCat once the Meta SDK is installed. Check RevenueCat's doc for the exact React Native calls.

## 4. App update (EAS build, not Expo Go)
- [ ] Install the Meta SDK (`react-native-fbsdk-next`) for install and app-open events
- [ ] iOS: Apple tracking prompt (`expo-tracking-transparency`) + `NSUserTrackingUsageDescription` text; pass the user's choice to the Meta SDK
- [ ] Update the App Store privacy "nutrition label" and Play data-safety form for the new tracking
- [ ] EAS build → TestFlight / internal testing
- [ ] Verify in Events Manager → **Test events** that install and purchase events arrive (use a sandbox purchase)

## 5. Creative ready
- [ ] Render demo videos 47–53 (`node generate-ugc-video.ts <n>`; 50 is organic only)
- [ ] AI-generated label on each
- [ ] Run the Control Room setup interview (`meta-ads-control-room/SETUP-INTERVIEW.md`) with real numbers

## 6. Launch
- [ ] First test campaign per `02-account-map-and-graveyard.md`, budget within `01`'s ceiling
- [ ] Follow `04-decision-rules.md`: no verdicts before the minimum data
