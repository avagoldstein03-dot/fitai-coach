-- Allow non-Stripe subscription grants (e.g. manual creator comps)
ALTER TABLE "Subscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "stripePriceId" DROP NOT NULL;

-- Explicit tier override (used by non-Stripe grants; Stripe-driven rows leave this null)
ALTER TABLE "Subscription" ADD COLUMN "tier" TEXT;

-- Marks where a subscription row originated
ALTER TABLE "Subscription" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'stripe';
