import prisma from "./prisma";
import type { SubscriptionTier } from "./subscription-middleware";

// In-app equivalent of scripts/grant-comp.js's upsert-with-protection logic
// (same shape, deliberately not shared — that script runs standalone via
// plain `node`, outside the Next.js/TS build pipeline, so importing a `@/`
// path-aliased module there isn't practical without adding a transpilation
// dependency this repo doesn't have). Grants a user N days of comped access
// starting now, refusing to shorten/overwrite an active subscription that
// didn't originate from a manual comp grant (i.e. a real paying Stripe or
// RevenueCat subscriber never gets silently downgraded by this).
export async function grantCompDays(userId: string, tier: SubscriptionTier, days: number): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { source: true, status: true, currentPeriodEnd: true },
  });

  const now = new Date();
  const activeUntil = existing?.currentPeriodEnd ? new Date(existing.currentPeriodEnd) : null;
  const hasActiveSubscription = existing?.status === "active" && activeUntil && activeUntil > now;

  if (hasActiveSubscription && existing!.source !== "manual-comp") {
    return; // real active subscription — don't touch it
  }

  // Extend from the later of "now" or an existing still-active comp grant's
  // expiry, so a second reward doesn't cost days off an unexpired first one.
  const base = hasActiveSubscription && activeUntil! > now ? activeUntil! : now;
  const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: "premium",
      status: "active",
      tier,
      source: "manual-comp",
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
    },
    update: {
      plan: "premium",
      status: "active",
      tier,
      source: "manual-comp",
      currentPeriodStart: now,
      currentPeriodEnd: expiresAt,
      cancelledAt: null,
    },
  });
}
