import * as StoreReview from "expo-store-review";

// A single shared trigger, called from a few genuinely positive moments
// (streak milestone, workout session complete, a good weekly review) rather
// than a fixed timer or a noisy per-action check. Apple's own StoreKit
// throttles how often the real dialog can appear (~3x/year) regardless of
// how many times this is called, but we still cap it to once per cold
// start so we're not hammering the API from multiple screens in one visit.
let requestedThisSession = false;

export function requestReviewOnce() {
  if (requestedThisSession) return;
  requestedThisSession = true;
  StoreReview.isAvailableAsync()
    .then((ok) => {
      if (ok) StoreReview.requestReview();
    })
    .catch(() => {});
}
