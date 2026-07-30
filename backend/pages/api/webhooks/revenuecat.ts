import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { sendSuccess, sendError } from "@/lib/api-utils";

// RevenueCat's own tier identifiers — must match the Entitlement names configured
// in the RevenueCat dashboard, which in turn match the Offering names already
// relied on in frontend/lib/purchases.ts's getOffering().
const TIER_PRIORITY = ["elite", "pro", "starter"] as const;
type Tier = (typeof TIER_PRIORITY)[number];

function resolveTier(entitlementIds: string[] | undefined): Tier | null {
  if (!entitlementIds?.length) return null;
  return TIER_PRIORITY.find((tier) => entitlementIds.includes(tier)) ?? null;
}

function isAuthorized(req: NextApiRequest): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  const provided = req.headers["authorization"];
  if (!expected || typeof provided !== "string") return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);

async function handleActiveEvent(event: any) {
  const tier = resolveTier(event.entitlement_ids);
  if (!tier) {
    console.error(
      `RevenueCat event ${event.type} for ${event.app_user_id} has no recognized entitlement in`,
      event.entitlement_ids
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: event.app_user_id },
    select: { id: true },
  });

  if (!user) {
    console.error(`RevenueCat webhook: no user found for clerkId ${event.app_user_id}`);
    return;
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "premium",
      status: "active",
      tier,
      source: "revenuecat",
      currentPeriodStart: new Date(event.purchased_at_ms),
      currentPeriodEnd: new Date(event.expiration_at_ms),
    },
    update: {
      plan: "premium",
      status: "active",
      tier,
      source: "revenuecat",
      currentPeriodStart: new Date(event.purchased_at_ms),
      currentPeriodEnd: new Date(event.expiration_at_ms),
      cancelledAt: null,
    },
  });

  console.log(`RevenueCat ${event.type}: granted ${tier} to user ${user.id}`);
}

async function handleExpiration(event: any) {
  const user = await prisma.user.findUnique({
    where: { clerkId: event.app_user_id },
    select: { id: true },
  });

  if (!user) {
    console.error(`RevenueCat webhook: no user found for clerkId ${event.app_user_id}`);
    return;
  }

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { status: "canceled", cancelledAt: new Date() },
  }).catch(() => {
    // No existing Subscription row for this user — nothing to expire.
  });

  console.log(`RevenueCat EXPIRATION: marked user ${user.id} canceled`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return sendError(res, "method_not_allowed", "Method not allowed", 405);
  }

  if (!isAuthorized(req)) {
    return sendError(res, "unauthorized", "Invalid webhook authorization", 401);
  }

  const event = req.body?.event;
  if (!event?.type || !event?.app_user_id) {
    return sendError(res, "invalid_payload", "Missing event data", 400);
  }

  try {
    if (ACTIVE_EVENT_TYPES.has(event.type)) {
      await handleActiveEvent(event);
    } else if (event.type === "EXPIRATION") {
      await handleExpiration(event);
    } else {
      // CANCELLATION (access continues until expiration_at_ms — the currentPeriodEnd
      // check in getUserSubscription() already handles that cutoff), BILLING_ISSUE,
      // TRANSFER, NON_RENEWING_PURCHASE, SUBSCRIPTION_PAUSED: not handled in v1.
      console.log(`Unhandled RevenueCat event type ${event.type}`);
    }

    sendSuccess(res, { received: true }, "Webhook processed");
  } catch (error) {
    console.error("Error processing RevenueCat webhook:", error);
    sendError(res, "webhook_error", "Failed to process webhook", 500);
  }
}
